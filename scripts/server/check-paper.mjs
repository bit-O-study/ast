import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function checkPaper({ fetchImpl = fetch, now = Date.now, readReport = () => readFile('logs/paper-observation.json', 'utf8') } = {}) {
  const at = now();
  const result = { at, errors: [], warnings: [], summary: null, observation: null };
  try {
    const response = await fetchImpl('http://127.0.0.1:8787/api/status', { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('API 응답 실패');
    const s = await response.json();
    if (s.mode !== 'paper') result.errors.push('모의투자 모드가 아닙니다');
    if (!Number.isFinite(s.price) || s.price <= 0 || !Number.isFinite(s.nextCandleAt)
        || !Number.isFinite(s.balance?.krw) || !Number.isFinite(s.balance?.coin)
        || !Number.isFinite(s.signal?.at) || typeof s.halted !== 'boolean'
        || typeof s.killed !== 'boolean' || s.position === undefined || s.lastError === undefined) {
      throw new Error('상태 형식 오류');
    }
    if (s.lastError) result.errors.push('매매 루프가 오류를 보고했습니다');
    if (s.nextCandleAt < at - 300_000) result.errors.push('봉 처리 예정 시각이 5분 이상 지났습니다');
    if (s.killed) result.errors.push('킬 스위치로 매매가 정지됐습니다');
    else if (s.halted) result.warnings.push('자동매매가 일시정지 상태입니다');
    result.summary = {
      mode: s.mode, price: s.price, krw: s.balance.krw, coin: s.balance.coin,
      hasPosition: s.position !== null, signalAt: s.signal.at, nextCandleAt: s.nextCandleAt,
    };
  } catch {
    // 네트워크/파싱 오류 원문에 내부 정보가 섞이지 않도록 고정 문구만 출력한다.
    result.errors.push('서버 상태를 읽을 수 없거나 응답 형식이 올바르지 않습니다');
  }
  try {
    const r = JSON.parse(await readReport());
    if (!['running', 'passed', 'failed'].includes(r.state) || !Number.isFinite(r.startedAt)
        || !Number.isFinite(r.lastSampleAt) || !Number.isInteger(r.samples) || r.samples < 1
        || !Array.isArray(r.issues) || r.lastSampleAt > at + 5000 || r.startedAt > r.lastSampleAt) {
      throw new Error('보고서 형식 오류');
    }
    if (r.state !== 'running' && (!Number.isFinite(r.finishedAt) || r.finishedAt < r.lastSampleAt || r.finishedAt > at + 5000)) {
      throw new Error('보고서 완료 시각 오류');
    }
    if (r.state === 'passed' && (r.issues.length || !(r.lastSignalAt > r.initialSignalAt)
        || !Number.isFinite(r.expectedCandleAt) || r.finishedAt < r.expectedCandleAt)) {
      throw new Error('통과 근거 없음');
    }
    result.observation = { state: r.state, samples: r.samples, lastSampleAt: r.lastSampleAt, finishedAt: r.finishedAt ?? null };
    if (r.state === 'running' && at - r.lastSampleAt > 90_000) result.warnings.push('관측 보고서가 90초 넘게 갱신되지 않았습니다');
    if (r.state === 'running' && (!Number.isFinite(r.deadline) || at > r.deadline)) result.warnings.push('관측 기한이 지났거나 유효하지 않습니다');
    if (r.state === 'failed') result.warnings.push('봉 마감 관측이 실패했습니다. 보고서를 확인하세요');
  } catch {
    result.warnings.push('관측 보고서가 없거나 형식이 올바르지 않습니다');
  }
  result.exitCode = result.errors.length ? 1 : result.warnings.length ? 2 : 0;
  return result;
}

const kst = (at) => new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium', hour12: false,
}).format(at) + ' KST';

export function formatCheck(r) {
  const lines = [`점검 시각: ${kst(r.at)}`, `운영 점검: ${r.exitCode === 0 ? '정상' : r.exitCode === 1 ? '오류' : '주의'}`];
  if (r.summary) {
    const s = r.summary;
    lines.push(`모드: ${s.mode === 'paper' ? '모의투자' : '모의투자 아님'}`, `현재가: ${s.price.toLocaleString('ko-KR')}원`,
      `잔고: ${s.krw.toLocaleString('ko-KR')}원 / ${s.coin} 코인`, `포지션: ${s.hasPosition ? '보유' : '없음'}`,
      `다음 봉 확인: ${kst(s.nextCandleAt)}`);
  }
  if (r.observation) {
    const o = r.observation;
    const labels = { running: '진행 중', passed: '이전 관측 통과', failed: '실패' };
    lines.push(`봉 마감 검증: ${labels[o.state]} (${o.samples}회 관측)`, `마지막 관측: ${kst(o.lastSampleAt)}`);
  }
  lines.push(...r.errors.map((x) => `오류: ${x}`), ...r.warnings.map((x) => `주의: ${x}`));
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await checkPaper();
  console.log(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : formatCheck(result));
  process.exitCode = result.exitCode;
}
