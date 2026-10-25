import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

// 서버의 읽기 전용 API만 관측한다. 주문이나 실행 상태는 변경하지 않는다.
export async function observePaper({
  fetchImpl = fetch, now = Date.now,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  save = async () => {}, intervalMs = 30_000,
} = {}) {
  const report = { state: 'running', startedAt: now(), samples: 0, issues: [] };
  let baseline, deadline;
  const read = async (path) => {
    const response = await fetchImpl(`http://127.0.0.1:8787/api/${path}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`API 응답 오류: ${path} (${response.status})`);
    return response.json();
  };
  try {
    while (true) {
      const status = await read('status');
      const events = await read('events');
      report.samples++;
      if (status.mode !== 'paper') throw new Error('모의투자 모드가 아닙니다');
      if (!Number.isFinite(status.signal?.at) || !Number.isFinite(status.nextCandleAt)) {
        throw new Error('봉 시각이 유효하지 않습니다');
      }
      if (!Array.isArray(events)) throw new Error('이벤트 응답이 유효하지 않습니다');
      if (baseline === undefined) {
        baseline = status.signal.at;
        report.initialSignalAt = baseline;
        report.expectedCandleAt = status.nextCandleAt;
        deadline = Math.min(status.nextCandleAt + 300_000, report.startedAt + 5 * 3600_000);
        report.deadline = deadline;
      }
      report.lastSampleAt = now();
      report.lastSignalAt = status.signal.at;
      report.price = status.price;
      if (status.lastError) throw new Error('서버가 매매 루프 오류를 보고했습니다');
      if (events.some((e) => e.type === 'error' && e.at >= report.startedAt)) {
        throw new Error('관측 중 오류 이벤트가 발생했습니다');
      }
      if (events.some((e) => e.type === 'start' && e.at >= report.startedAt)) {
        throw new Error('관측 중 매매 프로세스가 재시작됐습니다');
      }
      if (now() > deadline) throw new Error('관측 기한 안에 봉 마감을 확인하지 못했습니다');
      if (status.signal.at > baseline && now() >= report.expectedCandleAt) {
        report.state = 'passed';
        break;
      }
      await save(report);
      await sleep(Math.min(intervalMs, Math.max(1, deadline - now() + 1)));
    }
  } catch (error) {
    report.state = 'failed';
    report.issues.push(error.message);
  }
  report.finishedAt = now();
  await save(report);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = resolve('logs/paper-observation.json');
  await mkdir(dirname(output), { recursive: true });
  const report = await observePaper({
    save: (value) => writeFile(output, JSON.stringify(value, null, 2) + '\n', 'utf8'),
  });
  console.log(report.state === 'passed' ? '모의투자 봉 마감 관측 통과' : '모의투자 봉 마감 관측 실패');
  process.exitCode = report.state === 'passed' ? 0 : 1;
}
