// 모의투자 설정 즉시 변경. 진입·체결에만 영향을 주는 값만 바꾼다 (손절·목표 규칙은 제외).
// 포지션 보유 중 요청은 대기했다가 청산 뒤 첫 tick에 적용한다.
export const EDITABLE = {
  fee: { env: 'FEE_RATE', label: '수수료율', min: 0, max: 0.01 },
  slip: { env: 'SLIPPAGE', label: '슬리피지', min: 0, max: 0.01 },
  maxPositionKrw: { env: 'MAX_POSITION_KRW', label: '1회 최대 매수 금액', min: 0, max: Infinity, integer: true },
  risk: { env: 'RISK_PER_TRADE', label: '거래당 위험 비율', min: 0, max: 1, exclusiveMin: true },
  entryScore: { env: 'ENTRY_SCORE', label: '진입 점수 기준', min: 0, max: 100 },
};
const HISTORY = 50;

const pick = (cfg) => Object.fromEntries(Object.keys(EDITABLE).map((k) => [k, cfg[k]]));

// 변경 요청 전체를 검증한다. 하나라도 틀리면 전부 거부
export function validateChanges(changes, cfg) {
  const errors = [], values = {};
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length) {
    return { ok: false, errors: ['바꿀 설정이 없습니다'], values };
  }
  for (const [key, raw] of Object.entries(changes)) {
    const rule = EDITABLE[key];
    if (!rule) { errors.push(`바꿀 수 없는 설정입니다: ${key}`); continue; }
    const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
    if (typeof v !== 'number' || !Number.isFinite(v)) { errors.push(`${rule.label}: 숫자가 아닙니다`); continue; }
    if (rule.integer && !Number.isInteger(v)) { errors.push(`${rule.label}: 정수여야 합니다`); continue; }
    const max = key === 'maxPositionKrw' ? cfg.paperKrw : rule.max;
    const min = key === 'maxPositionKrw' ? cfg.minOrderKrw : rule.min;
    if (v < min || v > max || (rule.exclusiveMin && v === min)) {
      errors.push(`${rule.label}: ${rule.exclusiveMin ? `${min} 초과` : min} ~ ${max} 범위여야 합니다`); continue;
    }
    values[key] = v;
  }
  return { ok: errors.length === 0, errors, values };
}

export class Settings {
  // emit(type, data): Trader 이벤트 기록. hasPosition(): 보유 여부
  constructor({ cfg, store, now = Date.now, emit = () => {}, hasPosition = () => false }) {
    Object.assign(this, { cfg, store, now, emit, hasPosition });
    this.base = pick(cfg); // 시작 시점 .env 값
    this.enabled = cfg.mode === 'paper';
    const s = store.state.settings ??= {};
    s.overrides ??= {};
    s.pending ??= null;
    s.history ??= [];
    // 저장된 변경값은 paper에서만 다시 적용한다
    if (this.enabled) {
      const { ok, values } = validateChanges(s.overrides, cfg);
      if (ok) Object.assign(cfg, values); else if (Object.keys(s.overrides).length) s.overrides = {};
    }
  }

  get s() { return this.store.state.settings; }

  // 변경 요청. 보유 중이면 대기, 아니면 즉시 적용
  request(changes, { reason = '' } = {}) {
    if (!this.enabled) throw new Error('설정 즉시 변경은 모의투자(MODE=paper)에서만 쓸 수 있습니다');
    const { ok, errors, values } = validateChanges(changes, this.cfg);
    if (!ok) { const e = new Error(errors.join(' / ')); e.status = 400; throw e; }
    const diff = Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== this.cfg[k]));
    if (!Object.keys(diff).length && !this.s.pending) return { applied: false, pending: false, unchanged: true };
    if (this.hasPosition()) {
      this.s.pending = { at: this.now(), values: { ...(this.s.pending?.values ?? {}), ...values }, reason };
      this.record('pending', this.s.pending.values, reason);
      this.store.save();
      return { applied: false, pending: true, values: this.s.pending.values };
    }
    this.apply(values, reason, 'applied');
    return { applied: true, pending: false, values };
  }

  // 시작 시점 .env 값으로 되돌린다. keys가 없으면 전부
  reset(keys = Object.keys(EDITABLE)) {
    if (!this.enabled) throw new Error('설정 즉시 변경은 모의투자(MODE=paper)에서만 쓸 수 있습니다');
    const values = {};
    for (const k of keys) if (EDITABLE[k]) values[k] = this.base[k];
    if (!Object.keys(values).length) { const e = new Error('되돌릴 설정이 없습니다'); e.status = 400; throw e; }
    return this.request(values, { reason: '.env 값으로 되돌리기' });
  }

  // 청산 뒤 첫 tick에서 Trader가 부른다
  applyPending() {
    const p = this.s.pending;
    if (!this.enabled || !p || this.hasPosition()) return false;
    const { ok, values } = validateChanges(p.values, this.cfg);
    this.s.pending = null;
    if (ok) this.apply(values, p.reason, 'applied-after-close');
    else this.store.save();
    return ok;
  }

  apply(values, reason, status) {
    const changes = this.record(status, values, reason);
    Object.assign(this.cfg, values);
    for (const [k, v] of Object.entries(values)) {
      if (v === this.base[k]) delete this.s.overrides[k]; else this.s.overrides[k] = v;
    }
    this.store.save();
    const text = Object.entries(changes).map(([k, c]) => `${EDITABLE[k].label} ${c.from} → ${c.to}`).join(', ');
    this.emit('config', { msg: `설정 변경${status === 'applied-after-close' ? '(청산 후 적용)' : ''}: ${text}`, changes, status });
  }

  record(status, values, reason) {
    const changes = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { from: this.cfg[k], to: v }]));
    this.s.history.push({ at: this.now(), status, changes, reason: reason || null });
    if (this.s.history.length > HISTORY) this.s.history.splice(0, this.s.history.length - HISTORY);
    if (status === 'pending') this.emit('config', { msg: `설정 변경 대기(포지션 청산 후 적용): ${Object.keys(values).map((k) => EDITABLE[k].label).join(', ')}`, changes, status });
    return changes;
  }

  view() {
    return {
      enabled: this.enabled,
      items: Object.entries(EDITABLE).map(([key, r]) => ({
        key, env: r.env, label: r.label, value: this.cfg[key], base: this.base[key],
        overridden: key in this.s.overrides, pending: this.s.pending?.values?.[key] ?? null,
      })),
      pending: this.s.pending,
      history: this.s.history.slice(-20).reverse(),
    };
  }

  current() { return pick(this.cfg); }
}
