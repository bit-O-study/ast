import { WARM, planEntry } from './strategy.js';
import { getStrategy } from './strategies/index.js';
import { buildRegime } from './regime.js';
import { openPosition, priceAction, applyExit, onCandleClose, toTrade, completedHoldingBars } from './position.js';
import { computeStats } from './backtest.js';
import { firstAllocation, additionalAllocation, applyAdditional } from './scale.js';
import { reentryAllowed } from './reentry.js';
import { positionCap } from './sizing.js';

const kstDay = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);

// 실시간 매매 루프
//  - PRICE_POLL_SEC마다 현재가 확인 → 손절가·목표가 도달 시 매도, 계좌 손실 한도 확인
//  - 봉이 마감되면 판단 점수 계산 → 신규 진입 또는 보유 포지션 손절가 조정
export class Trader {
  // now: 현재 시각 함수. 리플레이 검증에서는 가짜 시계를 넣는다
  // settings·verifier는 모의투자 전용 선택 기능 (src/settings.js, src/verify/live.js)
  // portfolio: 여러 종목 동시 운용 시 계좌 단위 위험 판단 (src/portfolio.js)
  constructor({ cfg, client, broker, store, log = console.log, now = Date.now, settings = null, verifier = null, portfolio = null }) {
    Object.assign(this, { cfg, client, broker, store, log, now, settings, verifier, portfolio });
    this.unitMs = cfg.unit * 60e3;
    this.strategy = getStrategy(cfg.strategy);
    this.candles = [];
    this.ctx = null;
    this.I = null;
    this.regime = buildRegime([], { ...cfg, regimeFilter: 'off' });
    this.price = null;
    this.bal = null;
    this.nextCandleAt = 0;
    this.busy = false;
    this.lastError = null;
    const s = store.state;
    s.equityLog ??= [];
    s.halted ??= false;
    s.position ??= null;
  }

  get state() { return this.store.state; }

  emit(type, data) {
    const e = this.store.event(type, { at: this.now(), market: this.cfg.market, ...data });
    this.log(`[${new Date(e.at).toLocaleString('ko-KR')}] ${this.portfolio ? this.cfg.market + ' ' : ''}${type} ${data.msg ?? ''}`);
  }

  // 시세·잔고·봉을 읽고 기준점을 잡는다 (매매하지 않음)
  async init() {
    this.price = (await this.client.ticker(this.cfg.market)).price;
    this.bal = await this.broker.balance();
    await this.refreshCandles();
    const last = this.candles[this.candles.length - 1];
    // 시작 시점의 신호는 이미 지난 봉의 것이므로 매매하지 않고 기준점만 잡는다
    if (!(this.state.lastCandleT >= last.t)) this.state.lastCandleT = last.t;
    const eq = this.equity();
    this.state.startEquity ??= eq;
    this.state.day ??= kstDay(this.now());
    this.state.dayStartEquity ??= eq;
    this.store.save();
    this.emit('start', { msg: `${this.broker.name} · ${this.cfg.market} ${this.cfg.unit}분봉 · 평가금액 ${Math.round(eq).toLocaleString('ko-KR')}원` });
  }

  async start() {
    await this.init();
    this.timer = setInterval(() => this.tick(), this.cfg.pollSec * 1000);
    await this.tick();
  }

  stop() { clearInterval(this.timer); }

  equity(price = this.price) {
    return this.bal ? this.bal.krw + this.bal.coin * price : NaN;
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      // 보유 중 대기한 설정 변경은 청산 뒤 첫 tick에 적용한다
      if (!this.state.position) this.settings?.applyPending();
      this.price = (await this.client.ticker(this.cfg.market)).price;
      // 봉이 마감됐으면 손절가 조정·진입을 먼저 처리하고, 그 손절가로 현재가를 확인한다
      if (this.now() >= this.nextCandleAt) await this.onCandle();
      await this.checkPosition(this.price);
      await this.checkRisk(this.price);
      this.lastError = null;
    } catch (e) {
      this.lastError = { at: this.now(), message: e.message };
      this.emit('error', { msg: e.message });
    } finally {
      this.busy = false;
      this.verifier?.onTick();
    }
  }

  // 마감된 봉만 받아 지표와 점수를 갱신. 새 봉이 생겼으면 true
  async refreshCandles() {
    const now = this.now();
    const needed = Math.max(WARM + 2, this.strategy.minBars ?? 0);
    const count = Math.max(200, needed + 1);
    // 진행 봉1개를 제외해도 전략에 필요한 마감봉을 확보한다.
    const rows = count > 200
      ? await this.client.candlesRange(this.cfg.market, this.cfg.unit, count)
      : await this.client.candles(this.cfg.market, this.cfg.unit, { count });
    const closed = rows.filter((b) => b.t + this.unitMs <= now).slice(-Math.max(200, needed));
    if (closed.length < needed) throw new Error(`마감 봉이 부족합니다 (${closed.length}개, 필요 ${needed}개)`);
    this.candles = closed;
    this.ctx = this.strategy.prepare(closed);
    this.I = this.ctx.I;
    await this.refreshRegime(closed, now);
    const i = closed.length - 1;
    const last = closed[i];
    this.signal = { at: last.t, ...this.strategy.evaluate(this.ctx, i, this.cfg), regime: this.regime.state(last.t + this.unitMs) };
    const isNew = !(this.state.lastCandleT >= last.t);
    // 다음 봉 마감 직후(3초 여유)에 다시 확인. 아직 안 올라왔으면 15초 뒤 재시도
    this.nextCandleAt = isNew || last.t + 2 * this.unitMs > now ? last.t + 2 * this.unitMs + 3000 : now + 15000;
    return isNew;
  }

  // BTC 국면 필터 갱신. 차트의 모든 봉에 국면을 표시할 수 있도록 (차트 봉 수 + 이동평균 길이)만큼 받는다
  async refreshRegime(closed, now) {
    if (this.cfg.regimeFilter === 'off') {
      this.regime = buildRegime(closed, this.cfg);
      return;
    }
    const count = closed.length + Math.round((this.cfg.regimeDays * 1440) / this.cfg.unit) + 2;
    const rows = await this.client.candlesRange('KRW-BTC', this.cfg.unit, count);
    this.regime = buildRegime(rows.filter((b) => b.t + this.unitMs <= now), this.cfg);
  }

  async onCandle() {
    if (!(await this.refreshCandles())) return;
    const d = this.candles, I = this.I, i = d.length - 1, b = d[i];
    this.state.lastCandleT = b.t;
    this.pushEquity();
    if (this.cfg.scaleIn) await this.checkRisk(this.price);
    const pos = this.state.position;
    if (pos) {
      const notes = onCandleClose(pos, {
        at: b.t, close: b.c, prevClose: d[i - 1].c, atr: I.atr[i], s20: I.s20[i], prevS20: I.s20[i - 1],
        score: this.signal.score, barsHeld: completedHoldingBars(pos.entryCandleT, b.t, this.cfg.unit),
      }, this.cfg);
      for (const n of notes) this.emit('stop', { msg: `${n} → 손절가 ${Math.round(pos.stop).toLocaleString('ko-KR')}원`, positionId: pos.id, stop: pos.stop, stopType: pos.stopType });
      this.store.save();
      // 새 손절가·목표가 청산이 추가 매수보다 먼저다.
      if (pos.scale) {
        await this.checkPosition(this.price);
        if (this.state.position === pos) await this.addPosition();
      }
    } else if (this.signal.enter) {
      const rg = this.signal.regime;
      const w = (x) => Math.round(x).toLocaleString('ko-KR');
      if (rg && !rg.bull) this.emit('skip', { msg: `매수 신호(${this.signal.note})이지만 BTC 하락 국면${rg.ma ? ` (종가 ${w(rg.close)} < ${rg.days}일 평균 ${w(rg.ma)})` : ''}` });
      else if (this.state.halted || this.state.killed) this.emit('skip', { msg: `매수 신호(${this.signal.note})이지만 자동매매 일시정지 중` });
      else if (this.dailyBlocked()) this.emit('skip', { msg: '일일 손실 한도 도달로 신규 진입 중단' });
      else await this.enter();
    }
  }

  async enter() {
    const d = this.candles, i = d.length - 1, price = this.price;
    if (!reentryAllowed(this.state.lastLossSignalAt, d[i].t, this.cfg)) {
      this.emit('skip', { msg: `손실 청산 후 ${this.cfg.lossCooldownBars}봉 재진입 대기 중` }); return;
    }
    const plan = planEntry(d, this.I, i, price * (1 + this.cfg.slip), this.cfg);
    if (!plan.ok) { this.emit('skip', { msg: `매수 신호 ${this.signal.score.toFixed(0)}점, 진입 보류: ${plan.reason}` }); return; }
    this.bal = await this.broker.balance();
    // 위험 비율은 계좌 평가금액 기준 (포트폴리오면 전 종목 합계)
    const eq = this.portfolio ? this.portfolio.equity() : this.equity(price);
    const allocation = this.cfg.scaleIn ? firstAllocation({ cash: this.bal.krw, equity: eq, price: price * (1 + this.cfg.slip), plan, atr: this.I.atr[i], signalAt: d[i].t }, this.cfg) : null;
    if (this.cfg.scaleIn && !allocation) { this.emit('skip', { msg: '분할 예산·비용 반영 손익비 부족' }); return; }
    // 1회 상한: 상승장이 길게 이어지면 BOOST_POSITION_KRW (백테스트와 같은 positionCap)
    const cap = positionCap(this.cfg, this.regime.streak(d[i].t + this.unitMs));
    const krw = allocation?.cost ?? Math.min(((eq * this.cfg.risk) / plan.R) * price * (1 + this.cfg.fee), this.bal.krw * 0.999, cap);
    if (krw < this.cfg.minOrderKrw) { this.emit('skip', { msg: `주문 가능 금액 부족 (${Math.round(krw)}원)` }); return; }

    const fill = await this.broker.buyMarket(krw, price);
    // 실제 체결가 기준으로 손절가·목표가를 다시 잡는다 (불가하면 신호 시점 계획 유지)
    const replanned = planEntry(d, this.I, i, fill.price, this.cfg);
    const pos = openPosition({ at: this.now(), price: fill.price, qty: fill.qty, cost: fill.cost, plan: replanned.ok ? replanned : plan, signal: this.signal, strategy: this.strategy, scale: allocation?.scale });
    pos.entryCandleT = d[i].t;
    pos.id = `${this.cfg.market}-${pos.entryAt}`;
    this.state.position = pos;
    this.bal = await this.broker.balance();
    this.store.save();
    const w = (x) => Math.round(x).toLocaleString('ko-KR');
    this.emit('buy', { msg: `${pos.scale ? '1차 ' : ''}매수 ${w(fill.price)}원 × ${fill.qty.toFixed(8)} · 손절가 ${w(pos.stop)} · 1차 목표 ${w(pos.t1)} · 2차 목표 ${w(pos.t2)}`,
      positionId: pos.id, price: fill.price, qty: fill.qty, stop: pos.stop, t1: pos.t1, t2: pos.t2, score: this.signal.score, ...(pos.scale ? { stage: 1 } : {}), ...this.fillInfo(fill, cap), ...(cap > this.cfg.maxPositionKrw ? { boost: true } : {}) });
  }

  async addPosition() {
    const pos = this.state.position;
    if (!pos?.scale || this.cfg.mode !== 'paper') return;
    this.bal = await this.broker.balance();
    const signalAt = this.candles.at(-1).t;
    const allowed = !this.state.halted && !this.state.killed && !this.dailyBlocked() && (!this.signal.regime || this.signal.regime.bull);
    const allocation = additionalAllocation(pos, { cash: this.bal.krw, price: this.price * (1 + this.cfg.slip), signal: this.signal, signalAt, allowed }, this.cfg);
    if (!allocation) return;
    const fill = await this.broker.buyMarket(allocation.cost, this.price);
    applyAdditional(pos, fill, { at: this.now(), signalAt, analysis: this.signal.analysis ?? null });
    this.bal = await this.broker.balance();
    this.store.save();
    this.emit('buy', { msg: `2차 매수 ${Math.round(fill.price).toLocaleString('ko-KR')}원 · 평균단가 ${Math.round(pos.entryPrice).toLocaleString('ko-KR')}원 · 총 매수 ${Math.round(pos.cost).toLocaleString('ko-KR')}원`,
      positionId: pos.id, stage: 2, price: fill.price, qty: fill.qty, stop: pos.stop, t1: pos.t1, t2: pos.t2, ...this.fillInfo(fill) });
  }

  // 한 가격에서 1차·2차 목표가를 한꺼번에 넘을 수 있으므로 할 일이 없을 때까지 반복 (최대 3회)
  async checkPosition(price) {
    for (let k = 0; k < 3 && this.state.position; k++) {
      const act = priceAction(this.state.position, price, this.cfg);
      if (!act) return;
      await this.sell(act, price);
    }
  }

  async sell(act, price) {
    const pos = this.state.position;
    const fill = await this.broker.sellMarket(act.qty, price);
    const closed = applyExit(pos, { at: this.now(), price: fill.price, qty: fill.qty, proceeds: fill.proceeds, reason: act.reason, kind: act.kind }, this.cfg);
    this.bal = await this.broker.balance();
    const w = (x) => Math.round(x).toLocaleString('ko-KR');
    this.emit('sell', { msg: `${act.reason}: 매도 ${w(fill.price)}원 × ${fill.qty.toFixed(8)}${closed ? '' : ` · 남은 수량 손절가 ${w(pos.stop)}`}`,
      positionId: pos.id, price: fill.price, qty: fill.qty, kind: act.kind, remaining: pos.qty, ...this.fillInfo(fill) });
    if (closed) {
      const trade = toTrade(pos);
      if (this.cfg.lossCooldownBars && trade.pnl <= 0) this.state.lastLossSignalAt = this.state.lastCandleT;
      this.store.addTrade(trade);
      this.state.position = null;
      this.emit('close', { msg: `${trade.result} ${trade.pnl >= 0 ? '+' : ''}${w(trade.pnl)}원 (${trade.pct.toFixed(2)}%)`,
        positionId: pos.id, result: trade.result, pnl: trade.pnl, pct: trade.pct });
      this.pushEquity();
    }
    this.store.save();
  }

  // 체결 이벤트에 남기는 대조 정보 (실시간 검증용)
  fillInfo(fill, cap = this.cfg.maxPositionKrw) {
    return {
      ...(Number.isFinite(fill.cost) ? { cost: fill.cost } : {}), ...(Number.isFinite(fill.proceeds) ? { proceeds: fill.proceeds } : {}),
      fee: fill.fee ?? null, feeRate: this.cfg.fee, maxPositionKrw: cap,
    };
  }

  dailyBlocked() {
    if (this.portfolio) return this.portfolio.dailyBlocked();
    return this.equity() <= this.state.dayStartEquity * (1 - this.cfg.dailyLossLimit);
  }

  async checkRisk(price) {
    if (this.portfolio) return this.portfolio.checkRisk();
    const eq = this.equity(price);
    const today = kstDay(this.now());
    if (this.state.day !== today) { this.state.day = today; this.state.dayStartEquity = eq; this.store.save(); }
    if (!this.state.killed && eq <= this.state.startEquity * (1 - this.cfg.killSwitchLoss)) {
      this.emit('kill', { msg: `누적 손실 ${(this.cfg.killSwitchLoss * 100).toFixed(0)}% 도달: 전량 매도 후 정지` });
      await this.sellAll('킬 스위치');
      this.state.killed = true;
      this.store.save();
    }
  }

  pushEquity() {
    const log = this.state.equityLog;
    log.push({ t: this.now(), equity: this.equity() });
    if (log.length > 3000) log.splice(0, log.length - 3000);
  }

  // ── 대시보드 제어 ──
  pause(reason = '사용자 일시정지') { this.state.halted = true; this.state.haltReason = reason; this.store.save(); this.emit('pause', { msg: reason }); }
  resume() {
    if (this.state.killed) throw new Error('킬 스위치로 정지된 상태입니다. data/state.json 의 killed 를 확인 후 재시작하세요');
    this.state.halted = false; this.state.haltReason = null; this.store.save(); this.emit('resume', { msg: '자동매매 재개' });
  }
  async sellAll(reason = '수동 전량 매도') {
    this.pause(reason);
    if (this.state.position) await this.sell({ qty: this.state.position.qty, reason, kind: 'manual' }, this.price);
  }

  // ── 대시보드 조회 ──
  status() {
    const pos = this.state.position;
    const eq = this.equity();
    const trades = this.store.trades();
    const eqSeries = [...this.state.equityLog.map((e) => e.equity), eq].filter(Number.isFinite);
    return {
      mode: this.cfg.mode, broker: this.broker.name, market: this.cfg.market, unit: this.cfg.unit,
      strategy: { id: this.strategy.id, name: this.strategy.name }, regimeEnabled: this.regime.enabled,
      price: this.price, balance: this.bal, equity: eq, startEquity: this.state.startEquity,
      halted: this.state.halted, haltReason: this.state.haltReason, killed: !!this.state.killed,
      dailyBlocked: this.dailyBlocked(), nextCandleAt: this.nextCandleAt, lastError: this.lastError,
      signal: this.signal, position: pos && { ...pos, unrealized: pos.qty * this.price * (1 - this.cfg.fee) - pos.cost * (pos.qty / pos.qtyInit) },
      summary: computeStats(trades, eqSeries, this.state.startEquity),
      ...(this.verifier ? { verify: this.verifier.summary() } : {}),
    };
  }

  chart() {
    const d = this.candles, I = this.I;
    const scores = d.map((_, i) => (i >= WARM ? this.strategy.evaluate(this.ctx, i, this.cfg).score : null));
    const bull = d.map((b) => this.regime.isBull(b.t + this.unitMs));
    return {
      candles: d, s20: I.s20, s60: I.s60, bbU: I.bbU, bbL: I.bbL, scores, bull,
      trades: this.store.trades().filter((t) => t.exitAt >= d[0].t),
      position: this.state.position,
    };
  }
}
