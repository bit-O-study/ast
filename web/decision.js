const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (v, digits = 0) => Number.isFinite(v) ? v.toLocaleString('ko-KR', { maximumFractionDigits: digits }) : '—';

export function decisionHtml(analysis) {
  if (!analysis) return '';
  const details = detailHtml(analysis.details);
  if (analysis.kind === 'indicators') return details;
  if (analysis.kind === 'defensive') return `<div class="small"><p><b>방어형 필수 진입 조건</b></p>
    ${analysis.checks.map(c => `<div><b>${c.ok ? '충족' : '대기'}</b> ${esc(c.label)}: ${esc(c.reason)}</div>`).join('')}
    <p class="muted">설정된 BTC 국면 필터와 위 필수 조건 통과 후 주문 직전 비용 포함 손익비·추격 여부를 재검사합니다. 점수는 성공 확률이 아닙니다.</p></div>${details}`;
  return `<div class="small"><p>파동 관측: <b>${esc(analysis.wave.stage)}</b> · 되돌림 ${num(analysis.wave.retracement === null ? null : analysis.wave.retracement * 100, 1)}%<br>
    지지 ${num(analysis.wave.support)}원 · 저항 ${num(analysis.wave.resistance)}원</p>
    <p>수급 관측: ${esc(analysis.accumulation)}<br>상대 거래량 ${num(analysis.relativeVolume, 2)}배 · CMF ${num(analysis.cmf, 2)} · 기준 저점 VWAP ${num(analysis.avwap)}원</p>
    ${analysis.checks.map(c => `<div><b>${c.ok ? '충족' : '대기'}</b> ${esc(c.label)}: ${esc(c.reason)}</div>`).join('')}
    <p class="muted">점수는 성공 확률이 아닙니다. 파동은 확정된 고저점의 관측이며, 수급은 매집 추정치입니다.</p></div>${details}`;
}

export function detailHtml(details) {
  if (!details?.groups) return '';
  return `<div class="small"><p><b>세부 지표 관측 · ${details.groups.reduce((n, g) => n + g.items.length, 0)}항목</b></p>
    <p class="muted">아래는 참고 관측입니다. 실제 매수 조건은 위 전략 설명을 따릅니다. 같은 성격의 지표를 중복 득점으로 더하지 않습니다.</p>
    ${details.groups.map(g => `<details><summary>${esc(g.label)} · ${g.items.length}항목</summary>
      ${g.items.map(r => `<p><b>${esc(r.label)}</b>: ${num(r.value, 3)}${esc(r.unit)} · ${esc(r.state)}<br><span class="muted">${esc(r.meaning)}</span></p>`).join('')}
    </details>`).join('')}</div>`;
}

export function scaleHtml(pos) {
  if (!pos?.scale) return '';
  return `<div class="small"><p><b>${pos.scale.stage}차 매수 완료 / 최대 2차</b> · 계획 예산 ${num(pos.scale.budget)}원 · 누적 매수 ${num(pos.cost)}원</p>
    ${(pos.entries ?? []).map(e => `<div>${e.stage}차 매수: ${num(e.price)}원 · ${num(e.cost)}원 투입</div>`).join('')}
    <p class="muted">${pos.exits.length ? '매도 시작 후 추가 매수하지 않습니다.' : pos.scale.stage === 2 ? '분할 매수 완료. 손절가와 목표가로 관리합니다.' : '2차는 상승·구조 재확인 및 총 위험 한도 충족 시에만 매수합니다.'}</p></div>`;
}
