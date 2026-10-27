import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assess } from '../src/research/experiment.js';

const summary = [], changes = [], strictCandidates = [], zeroTrade = [];
const archive = 'logs/T026-before-parity';
const oldManifest = JSON.parse(fs.readFileSync(`${archive}/logs/T018-manifest.json`, 'utf8'));
for (const m of oldManifest) {
  const hash = createHash('sha256').update(fs.readFileSync(`logs/T018-${m.market}-candles.json`)).digest('hex');
  assert.equal(hash, m.sha256, '고정 원본 변경 금지');
}
let totalReplays = 0;
for (let n = 18; n <= 25; n++) {
  const id = `T0${n}`, old = JSON.parse(fs.readFileSync(`${archive}/logs/${id}-results.json`, 'utf8'));
  const current = JSON.parse(fs.readFileSync(`logs/${id}-results.json`, 'utf8'));
  const key = r => [r.market, r.segment, r.cost, r.strategy].join('/');
  const before = new Map(old.rows.map(r => [key(r), r]));
  assert.equal(current.rows.length, old.rows.length);
  assert.equal(new Set(current.rows.map(key)).size, current.rows.length);
  let changed = 0;
  for (const r of current.rows) {
    const previous = before.get(key(r));
    assert.ok(previous, '후보/구간/비용 추가 금지');
    const fields = ['ret', 'pnl', 'mdd', 'trades'].filter(k => r[k] !== previous[k]);
    if (fields.length) { changed++; changes.push({ id, key: key(r), fields, before: previous, after: r }); }
  }
  const replays = JSON.parse(fs.readFileSync(`logs/${id}-replay.json`, 'utf8'));
  for (const r of replays) {
    assert.ok(r.pass && r.entry === 1 && r.route === 1 && r.errors === 0, `${id} 실행 경로 불일치`);
    if (r.trades === 0) zeroTrade.push({ id, ...r });
  }
  totalReplays += replays.length;
  let pass = 0;
  for (const d of current.decisions) {
    const result = assess(current.rows, d.id);
    for (const r of current.rows.filter(r => r.strategy === d.id && r.cost === '기본' && r.segment !== '초기')) {
      const base = current.rows.find(b => b.strategy === 'score' && b.market === r.market && b.segment === r.segment && b.cost === r.cost);
      if (!(r.ret > 0 && r.ret > base.ret)) result.reasons.push(`${r.segment}/${r.market}: 양수·기존 초과 미충족`);
    }
    result.pass = result.reasons.length === 0;
    strictCandidates.push({ study: id, ...result });
    if (result.pass) pass++;
  }
  summary.push({ id, rows: current.rows.length, changed, candidates: current.decisions.length, pass, replays: replays.length });
}
const result = { summary, changes, strictCandidates, zeroTrade, totalReplays, inputHashesUnchanged: true };
fs.writeFileSync('logs/T026-audit.json', JSON.stringify(result, null, 2));
const lines = ['# 실행 경로 감사와 연구 재계산 · 2026-10-27', '',
  'T025 리플레이에서 드러난 보유기간 계산 불일치를 수정했다. 첫 보유봉 마감을 백테스트가0봉, Trader가1봉으로 계산하던 차이였다. 진입 직전 신호봉부터 경과 시간을 세는 공통 함수를 양쪽에서 사용한다. 현재 봉 포함200개 응답에서는199개만 마감되어200봉 모델이 준비되지 않는 문제도 minBars 기반 범위 조회로 보완했다. 기본 전략의 조회 방식은 유지했다.', '',
  '수정 전 합성 보유기간2건과 실제형200개 응답 테스트1건이 실패했고 수정 후 통과했다. 후보/임계치/비용/원본 데이터는 바꾸지 않았다. 수정 전130개 파일은 logs/T026-before-parity/에 보존했다. 입력 SHA2563개는 원본과 일치한다.', '',
  '| 연구 | 비교 행 | 변경된 행 | 후보 | 엄격 기준 통과 | 리플레이 |', '|---|---:|---:|---:|---:|---:|',
  ...summary.map(s => `| ${s.id} | ${s.rows} | ${s.changed} | ${s.candidates} | ${s.pass} | ${s.replays} |`), '',
  `합계 ${summary.reduce((s, r) => s + r.rows, 0)}개 비교(비교군 반복 포함), ${strictCandidates.length}개 후보, 리플레이${totalReplays}개 모두 진입/청산100%·오류0. 이 중 거래0건${zeroTrade.length}개는 거래 실행을 검증한 증거가 아니다.`, '',
  ...zeroTrade.map(r => `- 거래0건: ${r.id}/${r.market}/${r.strategy ?? r.profile}.`), '',
  `엄격 전종목·기간·비용·낙폭 기준 통과 후보: ${strictCandidates.filter(r => r.pass).map(r => `${r.study}/${r.id}`).join(', ') || '없음'}. 원본 상세·전후 차이 logs/T026-audit.json.`, '',
  'T018~025 보고서는 이 수정으로 재계산했다. T015~017의 과거 수익성 수치는 수정 전 자료이며 최신 성과 근거로 사용하지 않는다. 모의 실행 일치는 실거래 체결 가격·미래 수익 보장을 뜻하지 않는다. 모든 연구는 기존 관찰자료의 재사용 탐색이고 운영 배포는 하지 않았다.', ''];
fs.writeFileSync('docs/verify/2026-10-27_execution-parity.md', lines.join('\n'));
const marker = '2026-10-27 T026 재계산';
for (const name of fs.readdirSync('docs/verify')) {
  if (!/^2026-10-26_.*(methods|exits|entry-filters|persistent|entry-quality|long-trend|timeframes|rolling-forecast).*\.md$/.test(name)) continue;
  const path = `docs/verify/${name}`, text = fs.readFileSync(path, 'utf8');
  if (!text.includes(marker)) fs.writeFileSync(path, `> ${marker}: 보유기간 계산을 실제 경로에 맞춰 수정했다. [감사 기록](2026-10-27_execution-parity.md). 수정 전 자료는 logs/T026-before-parity/에 보존.\n\n${text}`);
}
console.log(JSON.stringify({ summary, totalReplays, zeroTrade, passed: strictCandidates.filter(r => r.pass).map(r => [r.study, r.id]) }, null, 2));
