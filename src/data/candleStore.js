import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const updates = new Map();
const units = new Set([1, 3, 5, 10, 15, 30, 60, 240]);
const fields = ['t', 'o', 'h', 'l', 'c', 'v', 'value'];

export function toKst(t) {
  if (!Number.isSafeInteger(t)) throw new Error('캔들 시각이 올바르지 않습니다');
  return new Date(t + 9 * 3600000).toISOString().slice(0, 19);
}

function normalize(rows, unit) {
  if (!Array.isArray(rows)) throw new Error('캔들 응답은 배열이어야 합니다');
  const result = new Map();
  for (const row of rows) {
    if (!row || fields.some((key) => !Number.isFinite(row[key])) ||
        !Number.isSafeInteger(row.t) || row.t < 0 || (row.t + 9 * 3600000) % (unit * 60000) !== 0 ||
        row.l <= 0 || row.h < Math.max(row.o, row.c, row.l) ||
        row.l > Math.min(row.o, row.c) || row.v < 0 || row.value < 0) {
      throw new Error('캔들 데이터의 시각·가격·거래량이 올바르지 않습니다');
    }
    result.set(row.t, Object.fromEntries(fields.map((key) => [key, row[key]])));
  }
  return [...result.values()].sort((a, b) => a.t - b.t);
}

export class CandleStore {
  constructor({ dir = 'data/candles', client, now = Date.now, sleepMs = 200 } = {}) {
    if (!client || typeof client.candles !== 'function') throw new Error('캔들 클라이언트가 필요합니다');
    if (typeof now !== 'function' || !Number.isFinite(sleepMs) || sleepMs < 0) {
      throw new Error('시각 함수 또는 요청 간격이 올바르지 않습니다');
    }
    this.dir = path.resolve(dir);
    this.client = client;
    this.now = now;
    this.sleepMs = sleepMs;
    this.requests = Promise.resolve();
    this.requested = false;
  }

  file(market, unit) {
    if (typeof market !== 'string' || !/^[A-Z0-9]+-[A-Z0-9]+$/.test(market) || !units.has(unit)) {
      throw new Error('마켓 또는 분봉 단위가 올바르지 않습니다');
    }
    return path.join(this.dir, `${market}_${unit}.jsonl`);
  }

  load(market, unit) {
    const file = this.file(market, unit);
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    try {
      return normalize(text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line)), unit);
    } catch (error) {
      throw new Error(`캔들 캐시를 읽을 수 없습니다: ${file}`, { cause: error });
    }
  }

  update(market, unit, { minBars = 1000 } = {}) {
    const file = this.file(market, unit);
    if (!Number.isSafeInteger(minBars) || minBars < 1) throw new Error('최소 봉 수는 양의 정수여야 합니다');
    // 같은 프로세스의 여러 인스턴스도 파일별로 순차 저장한다.
    const previous = updates.get(file) || Promise.resolve();
    const work = previous.catch(() => {}).then(() => this.refresh(market, unit, minBars));
    updates.set(file, work);
    const cleanup = () => { if (updates.get(file) === work) updates.delete(file); };
    work.then(cleanup, cleanup);
    return work;
  }

  request(market, unit, cursor) {
    const work = this.requests.then(async () => {
      if (this.requested && this.sleepMs) await sleep(this.sleepMs);
      this.requested = true;
      return normalize(await this.client.candles(market, unit, {
        count: 200, ...(cursor === undefined ? {} : { to: toKst(cursor) }),
      }), unit);
    });
    this.requests = work.catch(() => {});
    return work;
  }

  async refresh(market, unit, minBars) {
    const cutoff = this.now();
    if (!Number.isSafeInteger(cutoff)) throw new Error('현재 시각이 올바르지 않습니다');
    const closed = (row) => row.t + unit * 60000 <= cutoff;
    const cached = this.load(market, unit).filter(closed);
    const merged = new Map(cached.map((row) => [row.t, row]));
    const last = cached.at(-1)?.t;
    let cursor;
    let exhausted = false;
    const page = async () => {
      const rows = await this.request(market, unit, cursor);
      if (!rows.length) { exhausted = true; return rows; }
      if (cursor !== undefined && rows[0].t >= cursor) {
        throw new Error('캔들 페이지가 과거로 진행하지 않습니다');
      }
      // 잘못 포함된 경계 봉은 기존의 더 최신 응답을 덮어쓰지 않는다.
      for (const row of rows) {
        if (closed(row) && (cursor === undefined || row.t < cursor)) merged.set(row.t, row);
      }
      cursor = rows[0].t;
      return rows;
    };

    while (true) {
      const rows = await page();
      if (exhausted || (last !== undefined ? rows[0].t <= last : merged.size >= minBars)) break;
    }
    if (!exhausted && merged.size < minBars) {
      for (const time of merged.keys()) cursor = Math.min(time, cursor);
      while (merged.size < minBars && !exhausted) await page();
    }
    const result = [...merged.values()].sort((a, b) => a.t - b.t);
    const file = this.file(market, unit);
    fs.mkdirSync(this.dir, { recursive: true });
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temp, result.map((row) => JSON.stringify(row) + '\n').join(''), { flag: 'wx' });
      fs.renameSync(temp, file);
    } finally {
      fs.rmSync(temp, { force: true });
    }
    return result;
  }

  gaps(market, unit) {
    const rows = this.load(market, unit);
    const step = unit * 60000;
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const missing = Math.floor((rows[i].t - rows[i - 1].t) / step) - 1;
      if (missing > 0) result.push({ from: rows[i - 1].t + step, to: rows[i].t - step, missing });
    }
    return result;
  }
}
