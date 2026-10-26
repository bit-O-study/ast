const KST = 9 * 60 * 60 * 1000;

// 내부 시각은 UTC ms, 날짜 구분만 KST로 변환합니다.
export function kstDate(at) {
  if (!Number.isFinite(at)) return null;
  const date = new Date(at + KST);
  const year = date.getUTCFullYear();
  return year >= 1970 && year <= 9999 ? date.toISOString().slice(0, 10) : null;
}

export function monthInfo(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1970) {
    throw new Error('유효한 연월이 아닙니다.');
  }
  const [year, number] = month.split('-').map(Number);
  return { year, number, length: new Date(Date.UTC(year, number, 0)).getUTCDate(), offset: new Date(Date.UTC(year, number - 1, 1)).getUTCDay() };
}

export function shiftMonth(month, delta) {
  const { year, number } = monthInfo(month);
  if (!Number.isInteger(delta)) throw new Error('월 이동 값이 올바르지 않습니다.');
  const index = year * 12 + number - 1 + delta;
  if (index < 1970 * 12 || index > 9999 * 12 + 11) return month;
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
}

export function summarizeMonth(trades, month) {
  if (!Array.isArray(trades)) throw new Error('거래 목록이 올바르지 않습니다.');
  const info = monthInfo(month);
  const days = Array.from({ length: info.length }, (_, i) => ({
    key: `${month}-${String(i + 1).padStart(2, '0')}`, day: i + 1, pnl: 0, count: 0, wins: 0, losses: 0, trades: [],
  }));
  let invalid = 0;
  for (const trade of trades) {
    const key = kstDate(trade?.exitAt);
    if (!key || !Number.isFinite(trade?.pnl)) { invalid++; continue; }
    if (!key.startsWith(month + '-')) continue;
    const day = days[Number(key.slice(8)) - 1];
    day.pnl += trade.pnl; day.count++;
    if (trade.pnl > 0) day.wins++; else day.losses++;
    day.trades.push(trade);
  }
  const summary = { pnl: 0, count: 0, wins: 0, losses: 0 };
  for (const day of days) {
    day.trades.sort((a, b) => b.exitAt - a.exitAt);
    for (const key of Object.keys(summary)) summary[key] += day[key];
  }
  return { month, ...info, days, summary, invalid };
}
// 날짜 문자열의 일 단위 이동은 기기 시간대에 영향을 받지 않습니다.
export function shiftDay(day, delta) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isSafeInteger(delta)) throw new Error('날짜 이동 값이 올바르지 않습니다.');
  const info = monthInfo(day.slice(0, 7));
  const number = Number(day.slice(8));
  if (number < 1 || number > info.length) throw new Error('존재하지 않는 날짜입니다.');
  const date = new Date(Date.UTC(info.year, info.number - 1, number + delta));
  const year = date.getUTCFullYear();
  if (!(year >= 1970 && year <= 9999)) return day;
  return date.toISOString().slice(0, 10);
}


// CSV 문자열의 수식 해석을 막고 숫자는 원본 정밀도를 유지합니다.
function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (typeof value !== 'number' && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = String.fromCharCode(39) + text;
  const quote = String.fromCharCode(34);
  return quote + text.split(quote).join(quote + quote) + quote;
}
function kstTimestamp(at) {
  if (!kstDate(at)) return '';
  return new Date(at + KST).toISOString().slice(0, 19).replace('T', ' ');
}
export function recordedStrategy(trade) {
  const s = trade?.strategy;
  if (typeof s?.id !== 'string' || !s.id.trim()) return { id: null, name: '전략 정보 없음' };
  return { id: s.id, name: typeof s.name === 'string' && s.name.trim() ? s.name : s.id };
}

// undefined는 전체, null은 미상으로 실제 문자열 ID와 구분합니다.
export function filterStrategy(trades, id) {
  if (!Array.isArray(trades)) throw new Error('거래 목록이 올바르지 않습니다.');
  return id === undefined ? trades : trades.filter(trade => recordedStrategy(trade).id === id);
}

export function strategyChoices(trades) {
  const groups = new Map();
  for (const trade of [...trades].filter(t => kstDate(t?.exitAt) && Number.isFinite(t?.pnl)).sort((a, b) => b.exitAt - a.exitAt)) {
    const strategy = recordedStrategy(trade);
    if (!groups.has(strategy.id)) groups.set(strategy.id, strategy);
  }
  return [...groups.values()];
}

export function summarizeStrategies(trades, month) {
  const report = summarizeMonth(trades, month);
  const groups = new Map();
  for (const trade of report.days.flatMap(day => day.trades).sort((a, b) => b.exitAt - a.exitAt)) {
    const strategy = recordedStrategy(trade);
    if (!groups.has(strategy.id)) groups.set(strategy.id, { ...strategy, count: 0, wins: 0, losses: 0, pnl: 0, grossProfit: 0, grossLoss: 0 });
    const group = groups.get(strategy.id);
    group.count++; group.pnl += trade.pnl;
    if (trade.pnl > 0) group.wins++; else group.losses++;
    if (trade.pnl > 0) group.grossProfit += trade.pnl;
    if (trade.pnl < 0) group.grossLoss -= trade.pnl;
  }
  return [...groups.values()].map(group => ({
    ...group,
    winRate: group.wins / group.count * 100,
    averagePnl: group.pnl / group.count,
    profitFactor: group.grossLoss > 0 ? group.grossProfit / group.grossLoss : null,
  }));
}

export function monthlyCsv(trades, month) {
  const report = summarizeMonth(trades, month);
  const rows = [['거래 ID', '진입 시각(KST)', '청산 시각(KST)', '진입가(원)', '청산가(원)', '수량', '청산 순손익(원)', '수익률(%)', '결과', '청산 사유', '전략 ID', '진입 전략']];
  const number = value => Number.isFinite(value) ? value : '';
  for (const day of report.days) {
    for (const trade of day.trades) {
      rows.push([trade.positionId ?? '', kstTimestamp(trade.entryAt), kstTimestamp(trade.exitAt), number(trade.entryPrice), number(trade.exitPrice), number(trade.qty), trade.pnl, number(trade.pct), trade.pnl > 0 ? '성공' : '실패', Array.isArray(trade.exits) ? trade.exits.map(e => e?.reason ?? '').join(' → ') : trade.reason ?? '', recordedStrategy(trade).id ?? '', recordedStrategy(trade).name]);
    }
  }
  return { csv: '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n', count: report.summary.count, invalid: report.invalid };
}
