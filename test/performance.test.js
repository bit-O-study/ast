import test from 'node:test';
import assert from 'node:assert/strict';
import { kstDate, monthInfo, shiftMonth, shiftDay, monthlyCsv, summarizeMonth, summarizeStrategies, filterStrategy, strategyChoices } from '../web/performance.js';
const trade = (at, pnl) => ({ exitAt: Date.parse(at), pnl });

test('전략 필터는 전체·미상·동일 이름의 다른 ID와 예약어 ID를 구분한다', () => {
  const list = [null, trade('2026-10-25T00:00:00Z', -1), ...['null', 'all', 'score', ''].map(id => ({ ...trade('2026-10-25T00:00:00Z', 2), strategy: { id, name: '같은 이름' } }))];
  assert.equal(filterStrategy(list, undefined), list);
  assert.equal(filterStrategy(list, null).length, 3);
  for (const id of ['null', 'all', 'score']) {
    const selected = filterStrategy(list, id);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].strategy.id, id);
  }
  assert.deepEqual(filterStrategy(list, 'missing'), []);
  assert.throws(() => filterStrategy(null, 'score'));
});

test('전략 선택지는 월 밖 최신 유효 기록을 사용하고 원본을 보존한다', () => {
  const list = Object.freeze([
    { ...trade('2026-10-25T00:00:00Z', 1), strategy: { id: 'score', name: '이전' } },
    { ...trade('2026-11-25T00:00:00Z', 2), strategy: { id: 'score', name: '최신' } },
    { exitAt: Infinity, pnl: 3, strategy: { id: 'bad' } },
    { ...trade('2026-12-25T00:00:00Z', NaN), strategy: { id: 'score', name: '무효' } },
    trade('2026-10-25T00:00:00Z', 0),
  ]);
  assert.deepEqual(strategyChoices(list), [{ id: 'score', name: '최신' }, { id: null, name: '전략 정보 없음' }]);
  assert.equal(list[0].strategy.name, '이전');
});

test('전략 필터 뒤 달력과 CSV는 같은 KST 월과 빈 결과를 사용한다', () => {
  const list = [
    { ...trade('2026-10-31T14:59:59Z', 10), strategy: { id: 'score' } },
    { ...trade('2026-10-31T15:00:00Z', 20), strategy: { id: 'score' } },
    trade('2026-10-31T14:59:59Z', -30),
  ];
  for (const [id, month, pnl, count] of [['score', '2026-10', 10, 1], ['score', '2026-11', 20, 1], [null, '2026-10', -30, 1], ['missing', '2026-10', 0, 0]]) {
    const filtered = filterStrategy(list, id);
    const report = summarizeMonth(filtered, month), csv = monthlyCsv(filtered, month);
    assert.equal(report.summary.pnl, pnl);
    assert.equal(report.summary.count, count);
    assert.equal(csv.count, count);
    assert.equal(csv.csv.split('\r\n').length, count + 2);
  }
});

test('KST 자정 전후와 월 경계로 청산일을 구분한다', () => {
  assert.equal(kstDate(Date.parse('2026-01-31T14:59:59.999Z')), '2026-01-31');
  assert.equal(kstDate(Date.parse('2026-01-31T15:00:00Z')), '2026-02-01');
  const list = [trade('2026-01-31T14:59:59.999Z', 100), trade('2026-01-31T15:00:00Z', -30)];
  assert.equal(summarizeMonth(list, '2026-01').summary.pnl, 100);
  assert.equal(summarizeMonth(list, '2026-02').days[0].pnl, -30);
});
test('연말·연초 월 이동과 지원 범위 경계', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('1970-01', -1), '1970-01');
  assert.equal(shiftMonth('9999-12', 1), '9999-12');
  assert.equal(kstDate(Date.parse('2026-12-31T15:00:00Z')), '2027-01-01');
});
test('윤년·평년과 달력 시작 요일', () => {
  assert.deepEqual(monthInfo('2024-02'), { year: 2024, number: 2, length: 29, offset: 4 });
  assert.equal(monthInfo('2025-02').length, 28);
  assert.equal(monthInfo('2100-02').length, 28);
  assert.equal(monthInfo('2000-02').length, 29);
  assert.equal(summarizeMonth([trade('2024-02-29T00:00:00Z', 5)], '2024-02').days[28].count, 1);
});
test('같은 날짜 복수 청산과 0원 실패를 합산하고 원본을 변경하지 않는다', () => {
  const list = Object.freeze([Object.freeze(trade('2026-10-25T00:00:00Z', 100.25)), Object.freeze(trade('2026-10-25T01:00:00Z', -20.5)), Object.freeze(trade('2026-10-25T02:00:00Z', 0))]);
  const r = summarizeMonth(list, '2026-10');
  assert.deepEqual(r.summary, { pnl: 79.75, count: 3, wins: 1, losses: 2 });
  assert.equal(r.days[24].trades[0], list[2]);
  assert.equal(list[0].pnl, 100.25);
});
test('부분 매도 내역을 중복 합산하거나 수수료를 재차감하지 않는다', () => {
  const t = { ...trade('2026-11-01T01:00:00Z', 700), entryAt: Date.parse('2026-10-01T00:00:00Z'), exits: [{ at: Date.parse('2026-10-31T00:00:00Z'), proceeds: 5000 }, { proceeds: 5700 }], cost: 10000 };
  assert.equal(summarizeMonth([t], '2026-10').summary.count, 0);
  assert.equal(summarizeMonth([t], '2026-11').summary.pnl, 700);
});
test('빈 월은 모든 날짜가 0건이며 미청산·잘못된 값은 제외 건수를 제공한다', () => {
  const r = summarizeMonth([null, {}, { exitAt: null, pnl: 1 }, { exitAt: Infinity, pnl: 1 }, { exitAt: Date.now(), pnl: '5' }, trade('2026-09-01T00:00:00Z', 4)], '2026-10');
  assert.equal(r.invalid, 5);
  assert.deepEqual(r.summary, { pnl: 0, count: 0, wins: 0, losses: 0 });
  assert.equal(r.days.length, 31);
  assert.ok(r.days.every(d => d.count === 0 && d.trades.length === 0));
  assert.equal(summarizeMonth([], '2026-10').invalid, 0);
});
test('잘못된 연월과 입력을 거부한다', () => {
  for (const m of ['2026-13', '2026-00', '26-01', '1969-12', '2026-1', '2026-01x']) assert.throws(() => monthInfo(m));
  assert.throws(() => summarizeMonth(null, '2026-01'));
  assert.throws(() => shiftMonth('2026-01', .5));
  assert.equal(kstDate(NaN), null);
});
test('날짜 이동은 월·연도·윤년 경계를 정확히 넘는다', () => {
  assert.equal(shiftDay('2026-10-01', -1), '2026-09-30');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDay('2024-03-01', -1), '2024-02-29');
  assert.equal(shiftDay('2025-03-01', -1), '2025-02-28');
  assert.equal(shiftDay('2026-10-01', -7), '2026-09-24');
});
test('날짜 이동은 잘못된 날짜와 범위 초과를 처리한다', () => {
  assert.equal(shiftDay('1970-01-01', -1), '1970-01-01');
  assert.equal(shiftDay('9999-12-31', 7), '9999-12-31');
  for (const day of ['2025-02-29', '2026-01-00', '2026-04-31', '2026-1-1']) assert.throws(() => shiftDay(day, 1));
  assert.throws(() => shiftDay('2026-01-01', .5));
});

test('CSV는 KST 선택 월만 원본 숫자 정밀도로 내보낸다', () => {
  const r = monthlyCsv([
    { ...trade('2026-01-31T15:00:00Z', -12.34567), qty: .12345678, entryAt: Date.parse('2026-01-31T14:00:00Z'), pct: -.0001 },
    trade('2026-01-31T14:59:59Z', 100),
  ], '2026-02');
  assert.equal(r.count, 1);
  assert.ok(r.csv.includes('2026-02-01 00:00:00'));
  assert.ok(r.csv.includes('2026-01-31 23:00:00'));
  assert.ok(r.csv.includes('"-12.34567"'));
  assert.ok(r.csv.includes('"0.12345678"'));
  assert.ok(!r.csv.includes('14:59:59'));
  assert.ok(!r.csv.includes("'-12.34567"));
});
test('CSV 한글 BOM과 인용부호·쉼표·줄바꿈을 보존한다', () => {
  const reason = '목표 "달성", 확인\n완료';
  const r = monthlyCsv([{ ...trade('2026-10-25T00:00:00Z', 1), reason }], '2026-10');
  assert.deepEqual([...Buffer.from(r.csv).subarray(0, 3)], [239, 187, 191]);
  assert.ok(r.csv.includes('"목표 ""달성"", 확인\n완료"'));
  assert.ok(r.csv.endsWith('\r\n'));
  assert.ok(r.csv.includes('청산 순손익(원)'));
});
test('CSV 문자열 수식을 중립화하고 숫자 손실은 유지한다', () => {
  for (const reason of ['=1+1', '+1', '-1', '@SUM(A1)', '\t=1', '  =1']) {
    const r = monthlyCsv([{ ...trade('2026-10-25T00:00:00Z', -2), reason }], '2026-10');
    assert.ok(r.csv.includes('"' + "'" + reason + '"'));
    assert.ok(r.csv.includes('"-2"'));
  }
});
test('CSV 빈 월은 헤더만, 잘못된 기록은 집계와 동일하게 제외한다', () => {
  assert.equal(monthlyCsv([], '2026-10').csv.split('\r\n').length, 2);
  const r = monthlyCsv([null, trade('2026-10-25T00:00:00Z', 0)], '2026-10');
  assert.equal(r.count, 1); assert.equal(r.invalid, 1);
  assert.ok(r.csv.includes('실패'));
  assert.ok(!r.csv.includes('undefined')); assert.ok(!r.csv.includes('NaN'));
});

test('전략별 합계는 KST 월 합계와 같고 기존 기록은 추정하지 않는다', async () => {
  const { summarizeStrategies } = await import('../web/performance.js');
  const list = [
    { ...trade('2026-10-25T00:00:00Z', 10.5), strategy: { id: 'score', name: '이전' } },
    { ...trade('2026-10-26T00:00:00Z', -2.5), strategy: { id: 'score', name: '최신' } },
    trade('2026-10-25T00:00:00Z', 0),
    { ...trade('2026-10-25T00:00:00Z', 4), strategy: { id: 'breakout' } },
    trade('2026-09-30T14:59:59Z', 999), null,
  ];
  const groups = summarizeStrategies(list, '2026-10');
  assert.deepEqual(groups.find(g => g.id === 'score'), { id: 'score', name: '최신', count: 2, wins: 1, losses: 1, pnl: 8, grossProfit: 10.5, grossLoss: 2.5, winRate: 50, averagePnl: 4, profitFactor: 4.2 });
  assert.equal(groups.find(g => g.id === null).name, '전략 정보 없음');
  for (const key of ['pnl', 'count', 'wins', 'losses']) assert.equal(groups.reduce((sum, g) => sum + g[key], 0), summarizeMonth(list, '2026-10').summary[key]);
  assert.deepEqual(summarizeStrategies([], '2026-10'), []);
  assert.equal(list[0].strategy.name, '이전');
});

test('전략 CSV는 저장 정보와 미상 값을 표시하며 수식을 중립화한다', () => {
  const r = monthlyCsv([{ ...trade('2026-10-25T00:00:00Z', 1), strategy: { id: '=1', name: '+전략' } }, trade('2026-10-25T00:00:00Z', 2)], '2026-10');
  assert.ok(r.csv.includes('전략 ID'));
  assert.ok(r.csv.includes("'=1"));
  assert.ok(r.csv.includes("'+전략"));
  assert.ok(r.csv.includes('전략 정보 없음'));
});

test('전략 수익계수는 평균 이익/손실이 아닌 순이익 합/순손실 합이다', () => {
  const list = [10, 30, -10, 0].map(pnl => ({ ...trade('2026-10-25T00:00:00Z', pnl), strategy: { id: 'score' } }));
  const [group] = summarizeStrategies(list, '2026-10');
  assert.equal(group.grossProfit, 40);
  assert.equal(group.grossLoss, 10);
  assert.equal(group.profitFactor, 4);
  assert.equal(group.winRate, 50);
  assert.equal(group.averagePnl, 7.5);
  assert.equal(group.losses, 2); // 기존 실패 열은 0원을 포함합니다.
  assert.equal(group.pnl, group.grossProfit - group.grossLoss);
});

test('전략 지표는 무손실·전부 손실·전부 0원·빈 월을 구분한다', () => {
  for (const [values, expected] of [
    [[10, 0], { winRate: 50, averagePnl: 5, profitFactor: null, grossProfit: 10, grossLoss: 0 }],
    [[-10, -30], { winRate: 0, averagePnl: -20, profitFactor: 0, grossProfit: 0, grossLoss: 40 }],
    [[0, 0], { winRate: 0, averagePnl: 0, profitFactor: null, grossProfit: 0, grossLoss: 0 }],
  ]) {
    const [group] = summarizeStrategies(values.map(pnl => trade('2026-10-25T00:00:00Z', pnl)), '2026-10');
    for (const [key, value] of Object.entries(expected)) assert.equal(group[key], value);
  }
  assert.deepEqual(summarizeStrategies([], '2026-10'), []);
});

test('전략 지표는 필터·유효 청산·KST 월 범위를 따른다', () => {
  const list = [
    { ...trade('2026-10-31T14:59:59Z', 12.5), strategy: { id: 'score' } },
    { ...trade('2026-10-31T15:00:00Z', -100), strategy: { id: 'score' } },
    { ...trade('2026-10-31T14:59:59Z', NaN), strategy: { id: 'score' } },
    trade('2026-10-31T14:59:59Z', -20),
  ];
  const filtered = filterStrategy(list, 'score');
  const [group] = summarizeStrategies(filtered, '2026-10');
  assert.equal(group.count, monthlyCsv(filtered, '2026-10').count);
  assert.equal(group.averagePnl, 12.5);
  assert.equal(group.winRate, 100);
  assert.equal(group.profitFactor, null);
  assert.equal(summarizeStrategies(filtered, '2026-11')[0].profitFactor, 0);
});
