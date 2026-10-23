// AST 자동매매 대시보드
const $ = (s) => document.querySelector(s);
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fin = Number.isFinite;
const won = (x) => (fin(x) ? Math.round(x).toLocaleString('ko-KR') : '—');
const sgn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '');
const signedWon = (x) => sgn(x) + won(Math.abs(x)) + '원';
const signedPct = (x, d = 2) => sgn(x) + Math.abs(x).toFixed(d) + '%';
const cls = (x) => (x > 0 ? 'pos' : x < 0 ? 'neg' : '');
const kst = (t, withYear) => {
  const d = new Date(t + 9 * 3600e3), p = (v) => String(v).padStart(2, '0');
  return `${withYear ? d.getUTCFullYear() + '-' : ''}${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const STOP_LABEL = { initial: '초기 손절가', breakeven: '본전 손절가', trail: '추적 손절가', breach: '이탈 경계 손절가', timeout: '보유기간 경계 손절가' };

const S = { status: null, chart: null, trades: [], filter: 'all', bt: null, hover: {} };
const api = async (p, opt) => {
  const r = await fetch(p, opt);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
};

// ───────── KPI ─────────
function kpiHtml(s, extra) {
  const pf = s.pf === null ? '∞' : s.pf.toFixed(2);
  return `
    <div class="kpi main"><div class="l">총 손익</div><div class="v ${cls(s.pnl)}">${signedWon(s.pnl)}</div><div class="s">평가금액 ${won(s.final)}원</div></div>
    <div class="kpi"><div class="l">수익률</div><div class="v ${cls(s.ret)}">${signedPct(s.ret)}</div><div class="s">시작 자본 ${won(s.capital)}원</div></div>
    <div class="kpi"><div class="l">승률</div><div class="v">${s.winRate.toFixed(0)}%</div><div class="s"><span class="pos">성공 ${s.wins}</span> · <span class="neg">실패 ${s.losses}</span></div></div>
    <div class="kpi"><div class="l">손익비</div><div class="v">${s.trades ? pf : '—'}</div><div class="s">이익 합 ÷ 손실 합</div></div>
    <div class="kpi"><div class="l">최대 낙폭</div><div class="v neg">−${s.mdd.toFixed(1)}%</div><div class="s">평가금액 고점 대비</div></div>
    ${extra}`;
}

// ───────── 포지션 · 손절가 · 목표가 ─────────
function renderPosition(st) {
  const p = st.position, price = st.price;
  if (!p) {
    $('#position').innerHTML = `<h3>보유 포지션</h3><p class="muted small">보유 중인 코인이 없습니다. 판단 점수가 +${st.config.entryScore} 이상이면 다음 봉 마감 때 매수하고, 그때 손절가와 목표가를 함께 정합니다.</p>`;
    return;
  }
  const dist = (x) => signedPct(((x - price) / price) * 100, 2);
  const pnlPct = (p.unrealized / (p.cost * (p.qty / p.qtyInit))) * 100;
  const hist = p.history.slice(-4).reverse().map((h) => `<div class="row"><span class="muted">${kst(h.at)} ${STOP_LABEL[h.type]}</span><span>${won(h.stop)}</span></div>`).join('');
  $('#position').innerHTML = `
    <h3>보유 포지션</h3>
    <div class="row"><span>진입가</span><span>${won(p.entryPrice)}원</span></div>
    <div class="row"><span>수량</span><span>${p.qty.toFixed(8)}${p.qty < p.qtyInit ? ` / ${p.qtyInit.toFixed(8)}` : ''}</span></div>
    <div class="row"><span>평가손익</span><span class="${cls(p.unrealized)}">${signedWon(p.unrealized)} (${signedPct(pnlPct)})</span></div>
    ${p.warn ? `<div class="warn-box">이탈 신호 (${kst(p.warn.at)} · ${esc(p.warn.reason)}): 바로 팔지 않고 손절가까지 더 떨어지면 매도합니다.</div>` : ''}
    <div class="lv stop"><span class="k">${STOP_LABEL[p.stopType]}</span><span class="p">${won(p.stop)}</span><span class="d down">${dist(p.stop)}</span>
      <span class="note">현재가가 이 가격 이하가 되면 전량 시장가 매도${p.stopType !== 'initial' ? ` · 처음 손절가 ${won(p.initialStop)}` : ''}</span></div>
    <div class="lv tgt ${p.t1Done ? 'done' : ''}"><span class="k">1차 목표가</span><span class="p">${won(p.t1)}</span><span class="d up">${p.t1Done ? '달성' : dist(p.t1)}</span>
      <span class="note">${p.t1Done ? '일부 매도 완료, 손절가를 본전 이상으로 올림' : `도달 시 ${Math.round(st.config.t1SellRatio * 100)}% 매도 후 손절가를 본전으로`}${p.planNote ? ' · ' + esc(p.planNote) : ''}</span></div>
    <div class="lv tgt"><span class="k">2차 목표가</span><span class="p">${won(p.t2)}</span><span class="d up">${dist(p.t2)}</span>
      <span class="note">${p.t1Done ? '도달 시 남은 수량 전량 매도' : '1차 목표 달성 후 작동'}</span></div>
    <details><summary class="small muted">손절가 변경 이력</summary>${hist}</details>`;
}

function renderSignal(sig, cfg, strategy) {
  if (!sig) { $('#signal').innerHTML = '<h3>판단 점수</h3><p class="muted small">계산 중</p>'; return; }
  const s = sig.score, rg = sig.regime;
  const v = sig.enter && rg && !rg.bull ? ['매수 보류', ''] : sig.enter ? ['매수 신호', 'pos'] : s <= -cfg.exitScore ? ['이탈 신호', 'neg'] : ['관망', ''];
  const regimeLine = !rg ? 'BTC 국면 필터 꺼짐'
    : rg.ma === null ? 'BTC 국면: 데이터 부족 (신규 매수 안 함)'
    : `BTC 국면 <b class="${rg.bull ? 'pos' : 'neg'}">${rg.bull ? '상승' : '하락'}</b> · 종가 ${won(rg.close)} / ${rg.days}일 평균 ${won(rg.ma)}${rg.bull ? '' : ' · 신규 매수 안 함'}`;
  $('#signal').innerHTML = `
    <h3>판단 <span class="muted small">${kst(sig.at)} 마감 봉 · ${esc(strategy?.name ?? '')} 전략</span></h3>
    <div><span class="verdict ${v[1]}">${v[0]}</span> <span class="mono ${cls(s)}" style="font-size:17px;margin-left:6px">${sgn(s)}${Math.abs(s).toFixed(0)}점</span></div>
    <div class="small muted">${esc(sig.note ?? '')}</div>
    <div class="small">${regimeLine}</div>
    <div class="small muted">${sig.trend ? '추세장' : '횡보장'} · ADX ${sig.adx.toFixed(0)} · RSI ${sig.rsi.toFixed(0)} · 이탈 기준 −${cfg.exitScore}</div>
    ${sig.parts.map((p) => `<div class="frow"><span>${p.label}</span><span class="bar"><i style="background:${p.s >= 0 ? 'var(--up)' : 'var(--down)'};${p.s >= 0 ? 'left' : 'right'}:50%;width:${Math.min(50, Math.abs(p.s) * 50)}%"></i></span><span class="p ${cls(p.pts)}">${sgn(p.pts)}${Math.abs(p.pts).toFixed(0)}</span></div>`).join('')}`;
}

function tradeRows(list) {
  if (!list.length) return `<tr><td colspan="10" class="empty">아직 청산된 거래가 없습니다.</td></tr>`;
  return list.map((t) => `<tr>
    <td><span class="tag ${t.pnl > 0 ? 'win' : 'loss'}">${t.result}</span></td>
    <td class="mono">${kst(t.entryAt, true)}</td><td class="n">${won(t.entryPrice)}</td>
    <td class="n down">${won(t.initialStop)}</td><td class="n up">${won(t.t1)} / ${won(t.t2)}</td>
    <td class="mono">${kst(t.exitAt, true)}</td><td class="n">${won(t.exitPrice)}</td>
    <td>${esc(t.exits.map((e) => e.reason).join(' → '))}</td>
    <td class="n ${cls(t.pnl)}">${signedWon(t.pnl)}</td><td class="n ${cls(t.pct)}">${signedPct(t.pct)}</td></tr>`).join('');
}

function renderTrades() {
  const list = S.trades.filter((t) => S.filter === 'all' || (S.filter === 'win') === t.pnl > 0);
  $('#trades tbody').innerHTML = tradeRows(list);
}

const EVENT_LABEL = { start: '시작', buy: '매수', sell: '매도', close: '청산', stop: '손절가', skip: '보류', error: '오류', kill: '킬 스위치', pause: '일시정지', resume: '재개' };
function renderEvents(list) {
  $('#events').innerHTML = list.length ? list.map((e) => `<li><time>${kst(e.at)}</time><span><span class="t ${e.type === 'buy' ? 'up' : e.type === 'sell' ? 'down' : ''}">${EVENT_LABEL[e.type] ?? e.type}</span> ${esc(e.msg ?? '')}</span></li>`).join('') : '<li class="empty">기록이 없습니다.</li>';
}

function renderStatus(st) {
  S.status = st;
  const b = $('#mode-badge');
  b.textContent = st.broker; b.className = 'badge' + (st.mode === 'live' ? ' live' : '');
  $('#market').textContent = `${st.market} · ${st.unit}분봉`;
  $('#price').textContent = won(st.price) + '원';
  $('#run-state').textContent = st.killed ? '킬 스위치 정지' : st.halted ? '신규 진입 일시정지' : st.dailyBlocked ? '일일 손실 한도 도달' : `작동 중 · 다음 판단 ${kst(st.nextCandleAt)}`;
  const alerts = [];
  if (st.lastError) alerts.push(`오류: ${st.lastError.message}`);
  if (st.killed) alerts.push('누적 손실 한도로 자동매매가 정지되었습니다.');
  $('#alert').hidden = !alerts.length; $('#alert').textContent = alerts.join(' · ');
  $('#btn-pause').hidden = st.halted; $('#btn-resume').hidden = !st.halted || st.killed;

  const sm = st.summary;
  $('#kpis').innerHTML = kpiHtml(sm, `<div class="kpi"><div class="l">보유 현금 · 코인</div><div class="v">${won(st.balance?.krw)}</div><div class="s">${(st.balance?.coin ?? 0).toFixed(6)} ${st.market.split('-')[1]}</div></div>`);
  renderPosition(st);
  renderSignal(st.signal, st.config, st.strategy);
}

// ───────── 차트 ─────────
function setup(cv) {
  const r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}
function ticks(lo, hi, count) {
  const step0 = (hi - lo) / count, mag = 10 ** Math.floor(Math.log10(step0)), f = step0 / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}
const axis = (v) => (v >= 1e8 ? (v / 1e8).toFixed(3) + '억' : v >= 1e5 ? Math.round(v / 1e4).toLocaleString('ko-KR') + '만' : won(v));
const idxAt = (candles, t, unitMs) => { for (let i = candles.length - 1; i >= 0; i--) if (candles[i].t <= t) return t < candles[i].t + unitMs * 2 ? i : -1; return -1; };

// data: { candles, s20, s60, bbU, bbL, scores, trades, position }
function drawChart(cv, data, opt) {
  const { ctx, w, h } = setup(cv);
  const d = data.candles, n = d.length;
  if (!n) return null;
  const C = { ink: css('--ink'), muted: css('--muted'), line: css('--line'), up: css('--up'), down: css('--down'), upS: css('--up-soft'), dnS: css('--down-soft'), ma1: css('--ma1'), ma2: css('--ma2'), band: css('--band'), acc: css('--accent') };
  const padR = w < 520 ? 56 : 74, x0 = 4, x1 = w - padR, top = 8, pH = Math.round(h * 0.7), sTop = pH + 14, sBot = h - 22;
  const bw = (x1 - x0) / n, X = (i) => x0 + bw * (i + 0.5), unitMs = opt.unitMs;
  const pos = data.position;
  let lo = Infinity, hi = -Infinity;
  d.forEach((b, i) => { lo = Math.min(lo, b.l, fin(data.bbL[i]) ? data.bbL[i] : Infinity); hi = Math.max(hi, b.h, fin(data.bbU[i]) ? data.bbU[i] : -Infinity); });
  if (pos) { lo = Math.min(lo, pos.stop); hi = Math.max(hi, pos.t1Done ? pos.t2 : pos.t1); }
  const py = (hi - lo) * 0.05; lo -= py; hi += py;
  const Y = (v) => top + ((hi - v) / (hi - lo)) * (pH - top);
  ctx.font = `11px ${css('--f-mono')}`; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;

  ticks(lo, hi, 5).forEach((v) => { const y = Math.round(Y(v)) + 0.5; ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillStyle = C.muted; ctx.fillText(axis(v), x1 + 6, y); });

  // BTC 하락 국면 (신규 매수 안 하는 구간)
  if (data.bull) {
    ctx.fillStyle = css('--sunken');
    for (let i = 0; i < n; i++) if (data.bull[i] === false) ctx.fillRect(X(i) - bw / 2, top, bw + 0.5, sBot - top);
  }
  // 청산된 거래 보유 구간
  const marks = [];
  for (const t of data.trades) {
    const i0 = t.entryIdx ?? idxAt(d, t.entryAt, unitMs), i1 = t.exitIdx ?? idxAt(d, t.exitAt, unitMs);
    if (i1 < 0) continue;
    const a = Math.max(0, i0 < 0 ? 0 : i0);
    ctx.fillStyle = t.pnl > 0 ? C.upS : C.dnS; ctx.fillRect(X(a) - bw / 2, top, (i1 - a + 1) * bw, pH - top);
    if (i0 >= 0) marks.push([i0, true]);
    marks.push([i1, false]);
  }
  // 볼린저밴드
  ctx.beginPath(); let st = false;
  for (let i = 0; i < n; i++) if (fin(data.bbU[i])) { st ? ctx.lineTo(X(i), Y(data.bbU[i])) : ctx.moveTo(X(i), Y(data.bbU[i])); st = true; }
  for (let i = n - 1; i >= 0; i--) if (fin(data.bbL[i])) ctx.lineTo(X(i), Y(data.bbL[i]));
  ctx.closePath(); ctx.fillStyle = C.band; ctx.fill();
  // 캔들
  const cw = Math.max(1, bw * 0.62);
  d.forEach((b, i) => {
    const col = b.c >= b.o ? C.up : C.down; ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(X(i), Y(b.h)); ctx.lineTo(X(i), Y(b.l)); ctx.stroke();
    const y1 = Y(Math.max(b.o, b.c)), y2 = Y(Math.min(b.o, b.c)); ctx.fillRect(X(i) - cw / 2, y1, cw, Math.max(1, y2 - y1));
  });
  [[data.s20, C.ma1], [data.s60, C.ma2]].forEach(([a, col]) => {
    ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.beginPath(); let s = false;
    for (let i = 0; i < n; i++) if (fin(a[i])) { s ? ctx.lineTo(X(i), Y(a[i])) : ctx.moveTo(X(i), Y(a[i])); s = true; }
    ctx.stroke();
  });
  ctx.lineWidth = 1;
  // 매수 ▲ / 매도 ▼
  for (const [i, buy] of marks) {
    const x = X(i), y = buy ? Y(d[i].l) + 4 : Y(d[i].h) - 4;
    ctx.fillStyle = buy ? C.up : C.down; ctx.beginPath();
    if (buy) { ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 8); ctx.lineTo(x + 5, y + 8); } else { ctx.moveTo(x, y); ctx.lineTo(x - 5, y - 8); ctx.lineTo(x + 5, y - 8); }
    ctx.closePath(); ctx.fill();
  }
  // 보유 포지션: 진입가 · 손절가 · 목표가 수평선
  if (pos) {
    const i0 = Math.max(0, idxAt(d, pos.entryCandleT ?? pos.entryAt, unitMs));
    const line = (v, col, label, dash) => {
      const y = Math.round(Y(v)) + 0.5;
      ctx.setLineDash(dash ? [5, 4] : []); ctx.strokeStyle = col; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(X(i0), y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.fillRect(x1 + 1, y - 8, padR - 2, 16);
      ctx.fillStyle = css('--surface'); ctx.fillText(label, x1 + 5, y);
    };
    line(pos.entryPrice, C.ink, '진입 ' + axis(pos.entryPrice), false);
    line(pos.stop, C.down, '손절 ' + axis(pos.stop), true);
    if (!pos.t1Done) line(pos.t1, C.up, '1차 ' + axis(pos.t1), true);
    line(pos.t2, C.up, '2차 ' + axis(pos.t2), true);
  }
  // 판단 점수 막대
  const mid = (sTop + sBot) / 2, SY = (v) => mid - (v / 100) * (sBot - sTop) / 2;
  ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(x0, Math.round(mid) + 0.5); ctx.lineTo(x1, Math.round(mid) + 0.5); ctx.stroke();
  data.scores.forEach((s, i) => {
    if (s === null) return;
    ctx.fillStyle = s >= 0 ? C.up : C.down; ctx.globalAlpha = s >= opt.entry || s <= -opt.exit ? 0.95 : 0.35;
    const y = SY(s); ctx.fillRect(X(i) - cw / 2, Math.min(y, mid), cw, Math.max(1, Math.abs(y - mid)));
  });
  ctx.globalAlpha = 1; ctx.setLineDash([4, 3]); ctx.strokeStyle = C.acc;
  [[opt.entry, `+${opt.entry} 매수`], [-opt.exit, `−${opt.exit} 이탈`]].forEach(([v, lab]) => {
    const y = Math.round(SY(v)) + 0.5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillStyle = C.acc; ctx.fillText(lab, x1 + 6, y);
  });
  ctx.setLineDash([]);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.muted;
  const k = w < 520 ? 4 : 7;
  for (let j = 0; j < k; j++) { const i = Math.round(((n - 1) * (j + 0.5)) / k); ctx.fillText(kst(d[i].t).slice(0, 11), X(i), h - 6); }
  ctx.textAlign = 'left';
  const hv = S.hover[cv.id];
  if (hv != null && hv < n) { ctx.strokeStyle = C.ink; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(Math.round(X(hv)) + 0.5, top); ctx.lineTo(Math.round(X(hv)) + 0.5, sBot); ctx.stroke(); ctx.globalAlpha = 1; }
  return { x0, bw, n };
}

function drawEquity(cv, bt) {
  const { ctx, w, h } = setup(cv);
  const eq = bt.equity, hold = bt.hold, n = eq.length, cap = bt.stats.capital;
  const C = { ink: css('--ink'), muted: css('--muted'), line: css('--line'), acc: css('--accent') };
  const padR = w < 520 ? 56 : 74, x0 = 4, x1 = w - padR, top = 6, bot = h - 18, X = (i) => x0 + ((x1 - x0) * (i + 0.5)) / n;
  let lo = cap, hi = cap;
  for (let i = 0; i < n; i++) { if (fin(eq[i])) { lo = Math.min(lo, eq[i], hold[i]); hi = Math.max(hi, eq[i], hold[i]); } }
  const p = (hi - lo) * 0.08 || cap * 0.01; lo -= p; hi += p;
  const Y = (v) => top + ((hi - v) / (hi - lo)) * (bot - top);
  ctx.font = `11px ${css('--f-mono')}`; ctx.textBaseline = 'middle';
  ticks(lo, hi, 4).forEach((v) => { const y = Math.round(Y(v)) + 0.5; ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillStyle = C.muted; ctx.fillText(axis(v), x1 + 6, y); });
  const path = (arr, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); let s = false; arr.forEach((v, i) => { if (!fin(v)) return; s ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)); s = true; }); ctx.stroke(); };
  ctx.setLineDash([4, 3]); path(eq.map(() => cap), C.acc, 1); ctx.setLineDash([]);
  path(hold, C.muted, 1.2); path(eq, C.ink, 2);
}

function attachHover(cv, tipSel, getData) {
  cv.addEventListener('pointermove', (e) => {
    const g = cv._geo, data = getData(); if (!g || !data) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
    const i = Math.max(0, Math.min(g.n - 1, Math.floor((x - g.x0) / g.bw)));
    if (S.hover[cv.id] === i) return;
    S.hover[cv.id] = i; redraw();
    const b = data.candles[i], sc = data.scores[i], tip = $(tipSel);
    tip.innerHTML = `<b class="mono">${kst(b.t, true)}</b>` + [['시가', won(b.o)], ['고가', won(b.h)], ['저가', won(b.l)], ['종가', won(b.c)], ['점수', sc === null ? '—' : sgn(sc) + Math.abs(sc).toFixed(0)]].map(([a, v]) => `<div><span>${a}</span><span>${v}</span></div>`).join('');
    tip.hidden = false;
    const ww = cv.clientWidth; let left = x + 14; if (left + tip.offsetWidth > ww) left = x - tip.offsetWidth - 14;
    tip.style.left = Math.max(0, left) + 'px'; tip.style.top = '10px';
  });
  cv.addEventListener('pointerleave', () => { S.hover[cv.id] = null; $(tipSel).hidden = true; redraw(); });
}

function redraw() {
  const st = S.status;
  if (S.chart && st && !$('#view-live').hidden) $('#cv-live')._geo = drawChart($('#cv-live'), S.chart, { unitMs: st.unit * 60e3, entry: st.config.entryScore, exit: st.config.exitScore });
  if (S.bt && st && !$('#view-bt').hidden) {
    $('#cv-bt')._geo = drawChart($('#cv-bt'), { ...S.bt, position: null }, { unitMs: st.unit * 60e3, entry: st.config.entryScore, exit: st.config.exitScore });
    drawEquity($('#cv-bt-eq'), S.bt);
  }
}

// ───────── 데이터 갱신 ─────────
async function loadStatus() { try { renderStatus(await api('/api/status')); redraw(); } catch (e) { $('#run-state').textContent = '서버 연결 끊김'; } }
async function loadChart() { try { S.chart = await api('/api/chart'); redraw(); } catch {} }
async function loadLists() {
  try { S.trades = await api('/api/trades'); renderTrades(); renderEvents(await api('/api/events')); } catch {}
}

async function runBacktest() {
  const btn = $('#bt-run'); btn.disabled = true; btn.textContent = '시세 받는 중…';
  try {
    S.bt = await api('/api/backtest?count=' + $('#bt-count').value);
    const s = S.bt.stats, diff = s.ret - s.holdRet;
    $('#bt-kpis').innerHTML = kpiHtml(s, `<div class="kpi"><div class="l">단순 보유 대비</div><div class="v ${cls(diff)}">${sgn(diff)}${Math.abs(diff).toFixed(1)}%p</div><div class="s">보유 시 ${signedPct(s.holdRet, 1)} · 보류 신호 ${S.bt.skipped}건</div></div>`);
    $('#bt-trades tbody').innerHTML = tradeRows(S.bt.trades);
    redraw();
  } catch (e) {
    $('#bt-kpis').innerHTML = `<div class="kpi" style="grid-column:1/-1"><div class="l">백테스트 실패</div><div class="s">${esc(e.message)}</div></div>`;
  } finally { btn.disabled = false; btn.textContent = '백테스트 실행'; }
}

const control = async (action) => { try { await api('/api/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) }); } catch (e) { alert(e.message); } loadStatus(); loadLists(); };

// ───────── 이벤트 ─────────
function showTab(name) {
  $('#tab-live').setAttribute('aria-selected', name === 'live'); $('#tab-bt').setAttribute('aria-selected', name === 'bt');
  $('#view-live').hidden = name !== 'live'; $('#view-bt').hidden = name !== 'bt';
  if (name === 'bt' && !S.bt) runBacktest(); else redraw();
}
$('#tab-live').onclick = () => showTab('live');
$('#tab-bt').onclick = () => showTab('bt');
$('#bt-run').onclick = runBacktest;
$('#btn-pause').onclick = () => control('pause');
$('#btn-resume').onclick = () => control('resume');
$('#btn-sellall').onclick = () => { $('#confirm-sellall').hidden = false; $('#btn-sellall').hidden = true; };
$('#btn-sellall-no').onclick = () => { $('#confirm-sellall').hidden = true; $('#btn-sellall').hidden = false; };
$('#btn-sellall-yes').onclick = () => { $('#confirm-sellall').hidden = true; $('#btn-sellall').hidden = false; control('sell_all'); };
document.querySelectorAll('#filter button').forEach((b) => (b.onclick = () => {
  S.filter = b.dataset.f; document.querySelectorAll('#filter button').forEach((x) => x.setAttribute('aria-pressed', x === b)); renderTrades();
}));
attachHover($('#cv-live'), '#tip-live', () => S.chart);
attachHover($('#cv-bt'), '#tip-bt', () => S.bt);
new ResizeObserver(redraw).observe(document.body);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);

loadStatus(); loadChart(); loadLists();
setInterval(loadStatus, 5000);
setInterval(loadChart, 30000);
setInterval(loadLists, 10000);
