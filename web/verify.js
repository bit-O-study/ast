// 검증 탭: 실시간 검증 세션과 설정 즉시 변경 (모의투자 전용 API)
const STATE = { running: ['진행 중', 'wait'], passed: ['통과', 'ok'], failed: ['실패', 'fail'], stopped: ['중단', 'wait'] };
const CHECK = { ok: ['정상', 'ok'], fail: ['실패', 'fail'], wait: ['대기', 'wait'] };
// 화면 표시 단위: 비율은 %로, 금액은 원으로
const UNIT = { fee: ['%', 100], slip: ['%', 100], risk: ['%', 100], maxPositionKrw: ['원', 1], entryScore: ['점', 1] };
const shown = (key, v) => {
  if (v === null || v === undefined) return '—';
  const [u, k] = UNIT[key] ?? ['', 1];
  return u === '원' ? Math.round(v).toLocaleString('ko-KR') + '원' : +(v * k).toFixed(4) + u;
};

export function createVerifyView({ $, api, kst, won, esc }) {
  const data = { verify: null, settings: null };
  const post = (p, body) => api(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const notice = (sel, text) => { const el = $(sel); el.hidden = !text; el.textContent = text || ''; };
  let busy = false;
  const act = async (sel, run) => {
    if (busy) return;
    busy = true; notice(sel, '처리 중입니다…');
    try { await run(); } catch (e) { notice(sel, e.message); busy = false; return; }
    busy = false;
  };

  function renderVerify() {
    const v = data.verify, s = v?.session;
    $('#verify-start').disabled = !v?.enabled || s?.state === 'running';
    $('#verify-stop').hidden = s?.state !== 'running';
    $('#verify-report-btn').hidden = !s;
    $('#verify-session').hidden = !s;
    if (!v?.enabled) { $('#verify-state').textContent = '실시간 검증은 모의투자 모드에서만 쓸 수 있습니다.'; return; }
    $('#verify-state').textContent = s ? '' : '아직 시작한 검증이 없습니다. 기간을 정하고 검증 시작을 누르세요.';
    if (!s) return;
    const [label, tone] = STATE[s.state] ?? [s.state, 'wait'];
    const badge = $('#verify-badge');
    badge.textContent = label; badge.className = 'tag ' + tone;
    $('#verify-period').textContent = `${kst(s.startedAt, true)} ~ ${kst(s.finishedAt ?? s.endsAt, true)} KST · ${s.hours}시간 · ${s.market}`;
    const pct = Math.round(s.progress * 100);
    $('#verify-progress').setAttribute('aria-valuenow', pct);
    $('#verify-progress i').style.width = pct + '%';
    $('#verify-progress-label').textContent = `${pct}% · 처리한 봉 마감 ${s.candles}개 · 체결 ${s.fills.length}건 · 경고 ${s.warnings.length}건`
      + (s.state === 'running' ? ` · 남은 시간 ${Math.max(0, Math.ceil((s.endsAt - Date.now()) / 3600e3))}시간` : '');
    $('#verify-failure').hidden = !s.failure;
    $('#verify-failure').textContent = s.failure ? `실패 사유: ${s.failure.reason}` : '';
    $('#verify-checks tbody').innerHTML = s.checks.map((c) => {
      const [t, cl] = CHECK[c.state];
      return `<tr><td>${esc(c.label)}</td><td><span class="tag ${cl}">${t}</span></td><td class="small">${esc(c.detail)}</td></tr>`;
    }).join('');
    $('#verify-fills tbody').innerHTML = s.fills.length ? s.fills.map((f) => `<tr><td class="mono small">${kst(f.at)}</td><td>${f.type === 'buy' ? '매수' : '매도'}${f.stage ? ` ${f.stage}차` : ''}</td>`
      + `<td class="n mono">${won(f.price)}</td><td class="n mono">${won(f.amount)}</td><td class="n mono">${won(f.fee)}</td><td class="n mono">${shown('fee', f.feeRate)}</td>`
      + `<td class="n mono">${f.maxPositionKrw ? won(f.maxPositionKrw) : '—'}</td><td><span class="tag ${f.ok ? 'ok' : 'fail'}">${f.ok ? '일치' : '불일치'}</span></td></tr>`).join('')
      : '<tr><td colspan="8" class="muted small">검증 기간 중 체결이 아직 없습니다.</td></tr>';
    $('#verify-warnings').innerHTML = s.warnings.map((w) => `<li><time>${kst(w.at)}</time> ${esc(w.msg)}</li>`).join('');
  }

  function renderSettings() {
    const st = data.settings;
    if (!st) return;
    $('#settings-save').disabled = !st.enabled; $('#settings-reset').disabled = !st.enabled;
    const focused = document.activeElement?.closest?.('#settings-table') ? document.activeElement.id : null;
    const drafts = Object.fromEntries([...document.querySelectorAll('#settings-table input')].map((i) => [i.id, i.value]));
    $('#settings-table tbody').innerHTML = st.items.map((it) => {
      const [u, k] = UNIT[it.key] ?? ['', 1];
      const status = it.pending !== null ? `청산 후 ${shown(it.key, it.pending)} 적용 대기` : it.overridden ? '대시보드에서 변경됨' : '.env 값 사용';
      return `<tr><td><label for="set-${it.key}">${esc(it.label)}</label><div class="muted small mono">${it.env}</div></td>`
        + `<td class="n mono">${shown(it.key, it.value)}</td><td class="n mono">${shown(it.key, it.base)}</td>`
        + `<td><input id="set-${it.key}" data-key="${it.key}" data-scale="${k}" type="number" step="any" inputmode="decimal" placeholder="${+(it.value * k).toFixed(6)}" aria-describedby="set-${it.key}-unit"> <span id="set-${it.key}-unit" class="small">${u}</span></td>`
        + `<td class="small">${status}</td></tr>`;
    }).join('');
    // 5초 갱신 중에도 입력 중인 값과 포커스를 유지한다
    for (const [id, value] of Object.entries(drafts)) { const el = document.getElementById(id); if (el) el.value = value; }
    if (focused) document.getElementById(focused)?.focus();
    $('#settings-history').innerHTML = st.history.length ? st.history.map((h) => {
      const text = Object.entries(h.changes).map(([k, c]) => `${st.items.find((i) => i.key === k)?.label ?? k} ${shown(k, c.from)} → ${shown(k, c.to)}`).join(', ');
      const tag = { applied: '적용', pending: '대기', 'applied-after-close': '청산 후 적용' }[h.status] ?? h.status;
      return `<li><time>${kst(h.at)}</time><span><span class="tag wait">${tag}</span> ${esc(text)}${h.reason ? ` · ${esc(h.reason)}` : ''}</span></li>`;
    }).join('') : '<li class="muted small">변경 이력이 없습니다.</li>';
  }

  function renderNotify() {
    const k = data.notify?.kakao;
    if (!k) return;
    $('#notify-test').disabled = !k.enabled;
    $('#notify-state').textContent = k.enabled ? '켜짐 · 매수·매도·청산·오류·킬 스위치·실시간 검증 결과를 "나와의 채팅"으로 보냅니다.'
      : k.configured ? '설정은 켜져 있지만 로그인 토큰이 없거나 만료됐습니다. 서버 로그를 확인하세요.' : '꺼짐 · 서버 .env에 NOTIFY_KAKAO=on과 로그인 토큰이 필요합니다.';
  }

  async function load() {
    const [verify, settings, notify] = await Promise.all([api('/api/verify'), api('/api/settings'), api('/api/notify')]);
    data.verify = verify; data.settings = settings; data.notify = notify;
    renderVerify(); renderSettings(); renderNotify();
  }

  $('#verify-start').onclick = () => act('#verify-status', async () => {
    const hours = Number($('#verify-hours').value);
    data.verify = await post('/api/verify', { action: 'start', hours });
    renderVerify(); notice('#verify-status', `${hours}시간 실시간 검증을 시작했습니다.`);
  });
  $('#verify-stop').onclick = () => act('#verify-status', async () => {
    data.verify = await post('/api/verify', { action: 'stop' });
    renderVerify(); notice('#verify-status', '검증을 중단했습니다. 지금까지의 결과로 보고서를 남겼습니다.');
  });
  $('#verify-report-btn').onclick = () => act('#verify-status', async () => {
    const r = await api('/api/verify/report');
    const pre = $('#verify-report');
    pre.hidden = !pre.hidden; pre.textContent = r.markdown; notice('#verify-status', '');
  });
  $('#settings-form').onsubmit = (e) => {
    e.preventDefault();
    act('#settings-status', async () => {
      const changes = {};
      for (const input of document.querySelectorAll('#settings-table input')) {
        if (input.value.trim() === '') continue;
        const v = Number(input.value);
        if (!Number.isFinite(v)) throw new Error('숫자를 입력하세요');
        changes[input.dataset.key] = +(v / Number(input.dataset.scale)).toPrecision(12);
      }
      if (!Object.keys(changes).length) throw new Error('바꿀 값을 입력하세요');
      const r = await post('/api/settings', { changes, reason: $('#settings-reason').value.trim() });
      for (const input of document.querySelectorAll('#settings-table input')) input.value = '';
      $('#settings-reason').value = '';
      data.settings = r.settings; renderSettings();
      notice('#settings-status', r.pending ? '포지션 보유 중이라 청산 후 적용됩니다.' : r.unchanged ? '현재 값과 같아 바뀐 것이 없습니다.' : '설정을 바로 적용했습니다.');
    });
  };
  $('#notify-test').onclick = () => act('#notify-status', async () => {
    await post('/api/notify', {});
    notice('#notify-status', '테스트 알림을 보냈습니다. 카카오톡 "나와의 채팅"을 확인하세요.');
  });
  $('#settings-reset').onclick = () => act('#settings-status', async () => {
    const r = await post('/api/settings/reset', {});
    data.settings = r.settings; renderSettings();
    notice('#settings-status', r.pending ? '포지션 보유 중이라 청산 후 .env 값으로 돌아갑니다.' : '.env 값으로 되돌렸습니다.');
  });

  return { load };
}

// 실시간 탭 상단 알림: 진행 중·실패·최근 결과
export function verifyBanner(v) {
  if (!v) return '';
  if (v.state === 'running') return '';
  if (v.state === 'failed') return `실시간 검증 실패: ${v.failure?.reason ?? ''} · 검증 탭에서 확인하세요.`;
  if (v.state === 'passed' && Date.now() - v.finishedAt < 24 * 3600e3) return '실시간 검증을 통과했습니다. 검증 탭에서 보고서를 볼 수 있습니다.';
  return '';
}
