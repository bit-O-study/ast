import fs from 'node:fs';
import path from 'node:path';

// 모의투자 실시간 검증 세션 (V3). 매매 판단에는 관여하지 않고 이벤트와 Trader 상태만 점검한다.
export const MAX_GAP_MS = 10 * 60e3;       // tick 간격·봉 처리 지연 허용치
const REL = 1e-6;                          // 체결 대조 상대오차
const near = (a, b) => Math.abs(a - b) <= REL * Math.max(1, Math.abs(a), Math.abs(b));
const won = (x) => Math.round(x).toLocaleString('ko-KR');

export const CHECKS = [
  { key: 'mode', label: '모의투자 모드' },
  { key: 'loop', label: '매매 루프 연속성' },
  { key: 'candle', label: '봉 마감 처리' },
  { key: 'errors', label: '매매 루프 오류 없음' },
  { key: 'buys', label: '매수 체결 금액·수수료' },
  { key: 'sells', label: '매도 체결 대금·수수료' },
  { key: 'plan', label: '손절가·목표가 순서' },
];

// 매수 이벤트 대조. 문제 없으면 null, 있으면 사유
export function checkBuy(e) {
  if (![e.cost, e.fee, e.feeRate, e.price, e.qty].every(Number.isFinite)) return '체결 기록에 금액·수수료 정보가 없습니다';
  if (Number.isFinite(e.maxPositionKrw) && e.cost > e.maxPositionKrw * (1 + REL) && e.stage !== 2) return `매수 금액 ${won(e.cost)}원이 1회 최대 ${won(e.maxPositionKrw)}원 초과`;
  if (!near(e.fee, e.cost * e.feeRate)) return `수수료 ${e.fee}원 ≠ 금액×수수료율 ${e.cost * e.feeRate}원`;
  if (!near(e.qty, (e.cost - e.fee) / e.price)) return '수량이 (금액−수수료)÷체결가와 다름';
  return null;
}

export function checkSell(e) {
  if (![e.proceeds, e.fee, e.feeRate, e.price, e.qty].every(Number.isFinite)) return '체결 기록에 대금·수수료 정보가 없습니다';
  if (!near(e.proceeds, e.qty * e.price * (1 - e.feeRate))) return `매도 대금 ${won(e.proceeds)}원 ≠ 수량×체결가×(1−수수료율)`;
  return null;
}

export function checkPlan(e) {
  if (e.stage === 2) return null;
  if (![e.stop, e.price, e.t1, e.t2].every(Number.isFinite)) return '손절가·목표가 정보가 없습니다';
  if (!(e.stop < e.price && e.price < e.t1 && e.t1 < e.t2)) return `손절가 ${won(e.stop)} < 체결가 ${won(e.price)} < 1차 ${won(e.t1)} < 2차 ${won(e.t2)} 순서가 아님`;
  return null;
}

export class LiveVerifier {
  // trader: 세션을 저장하는 첫 종목, traders: 점검할 전 종목 (기본 [trader]), reportDir: 보고서 저장 폴더
  constructor({ cfg, store, trader, traders = [trader], now = Date.now, reportDir = path.join(store.dir, 'verify') }) {
    Object.assign(this, { cfg, store, trader, traders, now, reportDir });
    this.enabled = cfg.mode === 'paper';
    // 매매 루프가 남기는 이벤트를 받아 두었다가 tick 때 점검한다 (파일을 다시 읽지 않음)
    this.queue = [];
    for (const st of new Set(traders.map((t) => t.store))) st.onEvent((e) => { if (this.session?.state === 'running' && e.type !== 'verify') this.queue.push(e); });
  }

  get session() { return this.store.state.liveVerify ?? null; }

  start({ hours = 24 } = {}) {
    if (!this.enabled) throw new Error('실시간 검증은 모의투자(MODE=paper)에서만 쓸 수 있습니다');
    if (this.session?.state === 'running') { const e = new Error('이미 진행 중인 검증이 있습니다'); e.status = 409; throw e; }
    const h = Number(hours);
    if (!Number.isFinite(h) || h < 1 || h > 168) { const e = new Error('검증 시간은 1~168시간이어야 합니다'); e.status = 400; throw e; }
    const t = this.now();
    this.store.state.liveVerify = {
      id: new Date(t + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, ''),
      state: 'running', startedAt: t, endsAt: t + h * 3600e3, hours: h,
      unit: this.cfg.unit, market: this.traders.map((t) => t.cfg.market).join(','),
      config: { fee: this.cfg.fee, slip: this.cfg.slip, maxPositionKrw: this.cfg.maxPositionKrw, risk: this.cfg.risk, entryScore: this.cfg.entryScore },
      lastTickAt: t, startCandleT: this.trader.state.lastCandleT ?? null, candles: 0, lastCandleT: this.trader.state.lastCandleT ?? null,
      fills: [], warnings: [], failure: null, finishedAt: null, report: null,
    };
    this.store.save();
    this.trader.emit('verify', { msg: `실시간 검증 시작 · ${h}시간`, state: 'running' });
    return this.view();
  }

  stop() {
    const s = this.session;
    if (s?.state !== 'running') { const e = new Error('진행 중인 검증이 없습니다'); e.status = 409; throw e; }
    this.finish('stopped', null);
    return this.view();
  }

  // 매 tick 끝에 Trader가 부른다. 예외를 매매 루프로 넘기지 않는다
  onTick() {
    try { this.evaluate(); } catch (e) { this.trader.log?.(`실시간 검증 점검 오류: ${e.message}`); }
  }

  evaluate() {
    const s = this.session;
    if (s?.state !== 'running') return;
    const t = this.now(), st = this.trader.state, unitMs = s.unit * 60e3;
    const fail = (key, reason) => this.finish('failed', { key, reason, at: t });

    if (this.cfg.mode !== 'paper') return fail('mode', '모의투자 모드가 아닙니다');
    if (t - s.lastTickAt > MAX_GAP_MS) return fail('loop', `매매 루프가 ${Math.round((t - s.lastTickAt) / 60e3)}분 동안 멈췄습니다`);
    s.lastTickAt = t;

    // 종목별 봉 마감 처리. 첫 종목은 기존 세션 필드(lastCandleT·candles)를 이어 쓴다
    s.perMarket ??= {};
    for (const tr of this.traders) {
      const m = tr.cfg.market, lt = tr.state.lastCandleT;
      const c = (s.perMarket[m] ??= tr === this.trader ? { lastCandleT: s.lastCandleT, candles: s.candles } : { lastCandleT: lt ?? null, candles: 0 });
      if (Number.isFinite(lt) && lt !== c.lastCandleT) {
        if (Number.isFinite(c.lastCandleT) && lt > c.lastCandleT) c.candles += Math.round((lt - c.lastCandleT) / unitMs);
        c.lastCandleT = lt;
      }
      if (Number.isFinite(c.lastCandleT) && t > c.lastCandleT + 2 * unitMs + MAX_GAP_MS) {
        return fail('candle', `${m} ${new Date(c.lastCandleT + 2 * unitMs + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' ')} KST 마감 봉을 10분 넘게 처리하지 못했습니다`);
      }
    }
    // 화면·판정은 가장 적게 처리한 종목 기준
    s.candles = Math.min(...Object.values(s.perMarket).map((c) => c.candles));
    s.lastCandleT = s.perMarket[this.trader.cfg.market].lastCandleT;

    const events = this.queue.splice(0);
    for (const e of events) {
      if (e.at < s.startedAt) continue;
      if (e.type === 'error') return fail('errors', `매매 루프 오류: ${e.msg}`);
      if (e.type === 'start') s.warnings.push({ at: e.at, msg: '매매 프로세스 재시작' });
      if (e.type === 'buy' || e.type === 'sell') {
        const bad = e.type === 'buy' ? checkBuy(e) : checkSell(e);
        const planBad = e.type === 'buy' ? checkPlan(e) : null;
        s.fills.push({ at: e.at, market: e.market ?? null, type: e.type, stage: e.stage ?? null, price: e.price, qty: e.qty, amount: e.type === 'buy' ? e.cost : e.proceeds,
          fee: e.fee, feeRate: e.feeRate, maxPositionKrw: e.maxPositionKrw ?? null, ok: !bad && !planBad });
        if (bad) return fail(e.type === 'buy' ? 'buys' : 'sells', bad);
        if (planBad) return fail('plan', planBad);
      }
    }
    if (t >= s.endsAt) {
      const need = Math.max(0, Math.floor((s.hours * 3600e3) / unitMs) - 1);
      if (s.candles < need) return fail('candle', `처리한 봉 마감 ${s.candles}개 < 기대 ${need}개`);
      return this.finish('passed', null);
    }
    this.store.save();
  }

  finish(state, failure) {
    const s = this.session;
    Object.assign(s, { state, failure, finishedAt: this.now() });
    try {
      fs.mkdirSync(this.reportDir, { recursive: true });
      s.report = path.join(this.reportDir, `${s.id}.md`);
      fs.writeFileSync(s.report, this.report());
    } catch (e) { s.report = null; s.warnings.push({ at: this.now(), msg: `보고서 저장 실패: ${e.message}` }); }
    this.store.save();
    const label = { passed: '통과', failed: '실패', stopped: '중단' }[state];
    this.trader.emit('verify', { msg: `실시간 검증 ${label}${failure ? `: ${failure.reason}` : ''}`, state, failure });
  }

  checkStates() {
    const s = this.session;
    const has = (type) => s.fills.some((f) => f.type === type);
    return CHECKS.map(({ key, label }) => {
      if (s.failure?.key === key) return { key, label, state: 'fail', detail: s.failure.reason };
      if ((key === 'buys' || key === 'plan') && !has('buy')) return { key, label, state: 'wait', detail: '아직 매수 없음' };
      if (key === 'sells' && !has('sell')) return { key, label, state: 'wait', detail: '아직 매도 없음' };
      if (key === 'candle') {
        const per = s.perMarket && Object.keys(s.perMarket).length > 1 ? ` (${Object.entries(s.perMarket).map(([m, c]) => `${m.replace('KRW-', '')} ${c.candles}`).join(' · ')})` : '';
        return { key, label, state: s.candles || s.state === 'passed' ? 'ok' : 'wait', detail: `봉 마감 ${s.candles}개 처리${per}` };
      }
      return { key, label, state: s.state === 'failed' ? 'wait' : 'ok', detail: '' };
    });
  }

  view() {
    const s = this.session;
    if (!s) return { enabled: this.enabled, session: null };
    const t = this.now();
    const progress = s.state === 'running' ? Math.min(1, (t - s.startedAt) / (s.endsAt - s.startedAt)) : 1;
    return { enabled: this.enabled, session: { ...s, progress, checks: this.checkStates() } };
  }

  summary() {
    const s = this.session;
    return s && { id: s.id, state: s.state, startedAt: s.startedAt, endsAt: s.endsAt, finishedAt: s.finishedAt, failure: s.failure };
  }

  report() {
    const s = this.session, kst = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
    const label = { running: '진행 중', passed: '통과', failed: '실패', stopped: '중단' }[s.state];
    return [`# 실시간 모의투자 검증 ${s.id} · ${label}`, '',
      `- 기간: ${kst(s.startedAt)} ~ ${kst(s.finishedAt ?? s.endsAt)} KST (계획 ${s.hours}시간)`,
      `- 종목: ${s.market} ${s.unit}분봉 · 시작 설정: 수수료 ${s.config.fee}, 슬리피지 ${s.config.slip}, 1회 최대 ${won(s.config.maxPositionKrw)}원, 위험 ${s.config.risk}, 진입 점수 ${s.config.entryScore}`,
      `- 처리한 봉 마감: ${s.candles}개 · 체결: ${s.fills.length}건 · 경고: ${s.warnings.length}건`,
      s.failure ? `- 실패: ${s.failure.reason}` : '', '',
      '| 점검 | 결과 | 내용 |', '|---|---|---|',
      ...this.checkStates().map((c) => `| ${c.label} | ${{ ok: '정상', fail: '실패', wait: '해당 없음' }[c.state]} | ${c.detail} |`), '',
      ...(s.fills.length ? ['| 시각 | 구분 | 체결가 | 금액 | 수수료 | 수수료율 | 1회 최대 | 대조 |', '|---|---|---:|---:|---:|---:|---:|---|',
        ...s.fills.map((f) => `| ${kst(f.at)} | ${f.type === 'buy' ? '매수' : '매도'} | ${won(f.price)} | ${won(f.amount)} | ${f.fee?.toFixed(0)} | ${f.feeRate} | ${f.maxPositionKrw ? won(f.maxPositionKrw) : '—'} | ${f.ok ? '일치' : '불일치'} |`), ''] : []),
      ...(s.warnings.length ? ['경고:', ...s.warnings.map((w) => `- ${kst(w.at)} ${w.msg}`), ''] : []),
    ].join('\n');
  }
}
