import fs from 'node:fs';
import path from 'node:path';

// data/ 아래 JSON 파일 저장소. 상태는 state.json, 거래·이벤트는 줄 단위 JSON(jsonl)
export class Store {
  constructor(dir = 'data') {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.statePath = path.join(dir, 'state.json');
    this.tradesPath = path.join(dir, 'trades.jsonl');
    this.eventsPath = path.join(dir, 'events.jsonl');
    this.state = fs.existsSync(this.statePath) ? JSON.parse(fs.readFileSync(this.statePath, 'utf8')) : {};
    this.listeners = new Set();
  }

  // 이벤트 구독 (알림 등). 해제 함수를 돌려준다. 구독 함수의 오류는 매매 루프로 번지지 않는다.
  onEvent(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  save() {
    const tmp = this.statePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmp, this.statePath);
  }

  addTrade(trade) {
    fs.appendFileSync(this.tradesPath, JSON.stringify(trade) + '\n');
  }

  trades() {
    if (!fs.existsSync(this.tradesPath)) return [];
    return fs.readFileSync(this.tradesPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }

  event(type, data = {}) {
    const e = { at: Date.now(), type, ...data };
    fs.appendFileSync(this.eventsPath, JSON.stringify(e) + '\n');
    for (const fn of this.listeners) {
      try {
        const r = fn(e);
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch { /* 구독 오류 무시 */ }
    }
    return e;
  }

  events(limit = 100) {
    if (!fs.existsSync(this.eventsPath)) return [];
    const lines = fs.readFileSync(this.eventsPath, 'utf8').split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l)).reverse();
  }
}
