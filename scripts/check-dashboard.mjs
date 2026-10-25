import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// 별도 설치된 검증 도구만 사용하며 운영 서버에는 요청하지 않습니다.
const require = createRequire(import.meta.url);
const { chromium } = require(resolve(process.argv[2]));
const browser = await chromium.launch({ executablePath: process.argv[3], headless: true });
const out = resolve('logs/dashboard-check');
await mkdir(out, { recursive: true });
const failures = [], results = [];
const stats = { pf: 2, pnl: 10000, final: 10010000, ret: .1, capital: 10000000, winRate: 50, wins: 1, losses: 1, trades: 2, mdd: .5, holdRet: .2 };
const now = Date.UTC(2026, 9, 25, 3);
const candles = Array.from({ length: 80 }, (_, i) => ({ t: now - (80 - i) * 14400000, o: 100000000 + i * 10000, c: 100020000 + i * 10000, h: 100040000 + i * 10000, l: 99980000 + i * 10000 }));
const chart = { candles, s20: candles.map(c => c.c), s60: candles.map(c => c.o), bbU: candles.map(c => c.h), bbL: candles.map(c => c.l), scores: candles.map(() => 30), trades: [], position: null };
const trades = [10000, -5000].map((pnl, i) => ({ strategy: i ? null : { id: 'score', name: '<img src=x onerror=alert(1)> 점수 전략' }, pnl, pct: pnl / 100000, result: i ? '실패' : '성공', entryAt: now - 14400000, exitAt: now, entryPrice: 100000000, exitPrice: 101000000, initialStop: 98000000, t1: 102000000, t2: 104000000, exits: [{ reason: '목표 도달' }] }));
try {
  for (const width of [1440, 390, 320]) {
    for (const colorScheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme });
      await page.addInitScript(at => { Date.now = () => at; }, now);
      const errors = [], actions = [];
      const fail = new Set();
      let controlDelay = 0;
      page.on('pageerror', e => errors.push(e.message));
      const status = { mode: 'paper', broker: '모의투자', market: 'KRW-BTC', unit: 240, price: 100800000, nextCandleAt: now + 14400000, halted: false, killed: false, config: { entryScore: 50, exitScore: 40, t1SellRatio: .5 }, summary: stats, balance: { krw: 10000000, coin: 0 }, position: null, signal: null };
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'dashboard.test') return route.abort();
        if (url.pathname.startsWith('/api/')) {
          if (fail.has(url.pathname)) return route.fulfill({ status: 503, json: { error: '검증용 서버 오류' } });
          if (url.pathname === '/api/control' && controlDelay) await new Promise(r => setTimeout(r, controlDelay));
          let body;
          if (url.pathname === '/api/status') body = status;
          else if (url.pathname === '/api/chart') body = chart;
          else if (url.pathname === '/api/trades') body = trades;
          else if (url.pathname === '/api/events') body = [{ at: now, type: 'start', msg: '모의투자 검증' }];
          else if (url.pathname === '/api/backtest') body = { ...chart, stats, trades, skipped: 0, equity: candles.map(() => 10010000), hold: candles.map(() => 10020000) };
          else if (url.pathname === '/api/control') {
            const { action } = route.request().postDataJSON();
            actions.push(action);
            if (action === 'pause') status.halted = true;
            if (action === 'resume') status.halted = false;
            body = { ok: true };
          } else throw new Error('예상하지 않은 API: ' + url.pathname);
          return route.fulfill({ json: body });
        }
        const file = { '/': 'index.html', '/app.js': 'app.js', '/performance.js': 'performance.js', '/style.css': 'style.css' }[url.pathname];
        if (!file) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ body: await readFile(new URL('../web/' + file, import.meta.url)), contentType: file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' });
      });
      const check = async (name, fn) => {
        try { await fn(); results.push({ width, colorScheme, name, passed: true }); }
        catch (e) { failures.push({ width, colorScheme, name, error: e.message }); }
      };
      await page.goto('http://dashboard.test/');
      await page.waitForFunction(() => document.querySelector('#market').textContent.includes('KRW-BTC'));
      await check('초기 숨김', async () => {
        assert.equal(await page.locator('#view-bt').isVisible(), false);
        assert.equal(await page.locator('#confirm-sellall').isVisible(), false);
      });
      await check('수익 스타일 격리', async () => {
        assert.equal(await page.locator('#kpis .pos').first().evaluate(e => getComputedStyle(e).paddingTop), '0px');
        assert.equal(await page.locator('#position').evaluate(e => getComputedStyle(e).color), await page.locator('body').evaluate(e => getComputedStyle(e).color));
      });
      await check('페이지 가로 넘침 없음', async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '가로 넘침'));
      await check('거래 필터', async () => {
        await page.locator('[data-f="win"]').click();
        assert.equal(await page.locator('#trades tbody tr').count(), 1);
        await page.locator('[data-f="all"]').click();
        assert.equal(await page.locator('#trades tbody tr').count(), 2);
      });
      await check('매도 취소', async () => {
        await page.locator('#btn-sellall').click();
        assert.equal(await page.locator('#confirm-sellall').isVisible(), true);
        await page.locator('#btn-sellall-no').click();
        assert.equal(await page.locator('#confirm-sellall').isVisible(), false);
        assert.deepEqual(actions, []);
      });
      await check('일시정지와 재개', async () => {
        await page.locator('#btn-pause').click();
        await page.waitForFunction(() => !document.querySelector('#btn-resume').hidden);
        await page.locator('#btn-resume').click();
        await page.waitForFunction(() => document.querySelector('#btn-resume').hidden);
        assert.deepEqual(actions, ['pause', 'resume']);
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: resolve(out, `live-${width}-${colorScheme}.png`), fullPage: true });
      await check('백테스트 전환', async () => {
        await page.locator('#tab-bt').click();
        await page.waitForFunction(() => document.querySelector('#bt-kpis').textContent.includes('총 손익'));
        assert.equal(await page.locator('#view-live').isVisible(), false);
        assert.equal(await page.locator('#view-bt').isVisible(), true);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '백테스트 가로 넘침');
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: resolve(out, `backtest-${width}-${colorScheme}.png`), fullPage: true });
        await page.locator('#tab-live').click();
        assert.equal(await page.locator('#view-bt').isVisible(), false);
      });
      await check('조회 실패와 복구', async () => {
        fail.add('/api/status'); fail.add('/api/chart'); fail.add('/api/trades');
        await page.evaluate(async () => { await Promise.all([loadStatus(), loadChart(), loadLists()]); });
        const notice = await page.locator('#connection-status').textContent();
        assert.ok(notice.includes('계좌 상태') && notice.includes('가격 차트') && notice.includes('거래 내역') && notice.includes('마지막 성공'));
        assert.ok((await page.locator('#run-state').textContent()).includes('연결 끊김'));
        fail.clear();
        await page.evaluate(async () => { await Promise.all([loadStatus(), loadChart(), loadLists()]); });
        assert.equal(await page.locator('#connection-status').isVisible(), false);
      });
      await check('보유 포지션과 부분 매도', async () => {
        status.position = { entryPrice: 100000000, qty: .05, qtyInit: .1, cost: 10000000, unrealized: 40000, stop: 100000000, initialStop: 98000000, stopType: 'breakeven', t1: 102000000, t2: 104000000, t1Done: true, history: [{ at: now, type: 'breakeven', stop: 100000000 }] };
        await page.evaluate(() => loadStatus());
        const text = await page.locator('#position').textContent();
        assert.ok(text.includes('일부 매도 완료') && text.includes('본전 손절가') && text.includes('+40,000'));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      });
      await check('제어 중복 방지', async () => {
        controlDelay = 200;
        const before = actions.length;
        await page.evaluate(async () => {
          const first = control('pause');
          if (!document.querySelector('#btn-pause').disabled) throw new Error('버튼 잠금 실패');
          await Promise.all([first, control('pause')]);
        });
        assert.equal(actions.length, before + 1);
        assert.equal(await page.locator('#btn-resume').isDisabled(), false);
        controlDelay = 0;
      });
      await check('제어 실패 후 재요청 없음', async () => {
        fail.add('/api/control');
        const before = actions.length;
        await page.evaluate(() => control('resume'));
        assert.ok((await page.locator('#control-status').textContent()).includes('자동 재요청하지 않습니다'));
        assert.equal(actions.length, before);
        assert.equal(await page.locator('#btn-resume').isDisabled(), false);
        fail.clear();
      });
      await check('백테스트 실패 후 이전 결과 제거와 재시도', async () => {
        fail.add('/api/backtest');
        await page.evaluate(() => runBacktest());
        assert.ok((await page.locator('#bt-kpis').textContent()).includes('백테스트 실패'));
        assert.equal(await page.locator('#bt-trades tbody tr').count(), 0);
        assert.equal(await page.evaluate(() => S.bt), null);
        assert.equal(await page.evaluate(() => document.querySelector('#cv-bt')._geo), null);
        fail.clear();
        await page.evaluate(() => runBacktest());
        assert.equal(await page.locator('#bt-trades tbody tr').count(), 2);
      });
      await check('목표가 전체 표시', async () => {
        const labels = await page.evaluate(() => {
          const cv = document.querySelector('#cv-live'), ctx = cv.getContext('2d'), original = ctx.fillText;
          const labels = [];
          ctx.fillText = function(text, x, y, ...args) { if (/^(진입|손절|1차|2차) /.test(text)) labels.push({ text, y }); return original.call(this, text, x, y, ...args); };
          try {
            const position = { entryPrice: 100000000, stop: 98000000, t1: 102000000, t2: 120000000, t1Done: false, entryAt: S.chart.candles[0].t };
            drawChart(cv, { ...S.chart, position }, { unitMs: 14400000, entry: 50, exit: 40 });
            return { labels, limit: cv.getBoundingClientRect().height * .7 };
          } finally { ctx.fillText = original; }
        });
        assert.equal(labels.labels.length, 4);
        assert.ok(labels.labels.every(l => l.y >= 8 && l.y <= labels.limit), JSON.stringify(labels));
      });
      await check('고정 가격과 빈 차트', async () => {
        const result = await page.evaluate(() => {
          const cv = document.querySelector('#cv-live'), ctx = cv.getContext('2d'), originals = new Map(), bad = [];
          for (const name of ['moveTo', 'lineTo', 'fillRect', 'fillText']) {
            originals.set(name, ctx[name]);
            ctx[name] = function(...args) {
              const values = name === 'fillText' ? args.slice(1) : args;
              if (values.some(v => typeof v === 'number' && !Number.isFinite(v))) bad.push(name);
              return originals.get(name).apply(this, args);
            };
          }
          try {
            const candles = S.chart.candles.map(c => ({ ...c, o: 100, h: 100, l: 100, c: 100 }));
            const flat = { ...S.chart, candles, s20: candles.map(() => 100), s60: candles.map(() => 100), bbU: candles.map(() => 100), bbL: candles.map(() => 100) };
            drawChart(cv, flat, { unitMs: 14400000, entry: 50, exit: 40 });
            const empty = drawChart(cv, { ...flat, candles: [] }, { unitMs: 14400000, entry: 50, exit: 40 });
            return { bad, empty };
          } finally { for (const [name, fn] of originals) ctx[name] = fn; redraw(); }
        });
        assert.deepEqual(result.bad, []);
        assert.equal(result.empty, null);
      });
      await check('성과 탭 월 집계와 날짜 선택', async () => {
        await page.locator('#tab-performance').click();
        await page.waitForSelector('#perf-calendar button');
        assert.equal(await page.locator('#view-live').isVisible(), false);
        assert.equal(await page.locator('#view-bt').isVisible(), false);
        assert.equal(await page.locator('#perf-month').textContent(), '2026년 10월');
        assert.equal(await page.locator('#perf-calendar button').count(), 31);
        assert.ok((await page.locator('#perf-summary').textContent()).includes('+5,000원'));
        await page.locator('[data-day="2026-10-25"]').click();
        assert.equal(await page.locator('#perf-trades tbody tr').count(), 2);
        assert.ok(await page.locator('[data-day="2026-10-25"] .calendar-pnl').evaluate(e => e.getBoundingClientRect().height <= 22), '달력 금액이 한 줄에 표시돼야 함');
        assert.equal(await page.locator('#perf-day-summary').textContent(), '2건 · 순손익 +5,000원');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: resolve(out, 'performance-' + width + '-' + colorScheme + '.png'), fullPage: true });
      });
      await check('전략별 성과 및 저장된 이름 안전 표시', async () => {
        const table = page.locator('#perf-strategies');
        assert.equal(await table.locator('tbody tr').count(), 2);
        assert.equal(await table.locator('img').count(), 0);
        const text = await table.textContent();
        assert.ok(text.includes('<img src=x onerror=alert(1)> 점수 전략'));
        assert.ok(text.includes('전략 정보 없음'));
        assert.ok(text.includes('+10,000원'));
        assert.ok(text.includes('−5,000원'));
      });
      await check('빈 날짜와 빈 월 및 이번 달 이동', async () => {
        await page.locator('[data-day="2026-10-01"]').click();
        assert.ok((await page.locator('#perf-trades').textContent()).includes('선택한 날짜에 청산된 거래가 없습니다'));
        await page.locator('#perf-prev').click();
        assert.equal(await page.locator('#perf-month').textContent(), '2026년 9월');
        assert.equal(await page.locator('#perf-calendar button').count(), 30);
        assert.ok((await page.locator('#perf-state').textContent()).includes('청산된 거래가 없습니다'));
        await page.locator('#perf-next').click();
        assert.equal(await page.locator('#perf-month').textContent(), '2026년 10월');
        await page.locator('#perf-today').click();
        assert.equal(await page.locator('[data-day="2026-10-25"]').getAttribute('aria-pressed'), 'true');
      });
      await check('달력 갱신 실패 시 기존 데이터 유지 및 복구', async () => {
        fail.add('/api/trades');
        await page.evaluate(() => loadLists());
        assert.equal(await page.locator('#connection-status').isVisible(), true);
        assert.ok((await page.locator('#perf-summary').textContent()).includes('+5,000원'));
        fail.clear();
        await page.evaluate(() => loadLists());
        assert.equal(await page.locator('#connection-status').isVisible(), false);
        assert.equal(await page.locator('[data-day="2026-10-25"]').getAttribute('aria-pressed'), 'true');
      });
      await check('최초 거래 조회 실패를 빈 월로 표시하지 않음', async () => {
        fail.add('/api/trades');
        await page.reload();
        await page.locator('#tab-performance').click();
        await page.waitForSelector('#connection-status');
        assert.equal(await page.locator('#perf-content').isVisible(), false);
        assert.equal(await page.locator('#perf-export').isDisabled(), true);
        assert.ok(!(await page.locator('#perf-state').textContent()).includes('청산된 거래가 없습니다'));
        fail.clear();
        await page.evaluate(() => loadLists());
        await page.waitForSelector('#perf-calendar button');
        assert.ok((await page.locator('#perf-summary').textContent()).includes('+5,000원'));
      });
      await check('키보드 탭 이동과 화면 연결', async () => {
        await page.locator('#tab-performance').focus();
        await page.keyboard.press('Home');
        assert.equal(await page.locator('#tab-live').getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('#view-live').isVisible(), true);
        await page.keyboard.press('End');
        assert.equal(await page.locator('#tab-performance').getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('#tab-performance').getAttribute('aria-controls'), 'view-performance');
        assert.equal(await page.locator('#view-performance').getAttribute('aria-labelledby'), 'tab-performance');
        assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1);
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.locator('#tab-live').getAttribute('aria-selected'), 'true');
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.locator('#view-performance').isVisible(), true);
      });
      await check('방향키 날짜 이동과 월 경계', async () => {
        await page.locator('[data-day="2026-10-01"]').click();
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.locator('#perf-month').textContent(), '2026년 9월');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.day), '2026-09-30');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.day), '2026-10-08');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('End');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.day), '2026-10-31');
        await page.keyboard.press('Home');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.day), '2026-10-01');
        assert.equal(await page.locator('#perf-calendar button[tabindex="0"]').count(), 1);
      });
      await check('조회 갱신 후 날짜 포커스 유지', async () => {
        await page.locator('[data-day="2026-10-25"]').click();
        await page.evaluate(() => loadLists());
        assert.equal(await page.evaluate(() => document.activeElement.dataset.day), '2026-10-25');
        assert.equal(await page.locator('[data-day="2026-10-25"]').getAttribute('aria-pressed'), 'true');
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.day), '2026-10-26');
        assert.ok((await page.locator('#perf-day-title').textContent()).includes('2026-10-26'));
      });
      await check('실제 월별 CSV 다운로드', async () => {
        const waiting = page.waitForEvent('download');
        await page.locator('#perf-export').click();
        const download = await waiting;
        assert.equal(download.suggestedFilename(), 'AST-청산거래-2026-10.csv');
        const stream = await download.createReadStream();
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const data = Buffer.concat(chunks), csv = data.toString('utf8');
        assert.deepEqual([...data.subarray(0, 3)], [239, 187, 191]);
        const rows = csv.slice(1).trimEnd().split('\r\n');
        assert.equal(rows.length, 3);
        const total = rows.slice(1).reduce((sum, row) => sum + Number(row.split(',')[6].replaceAll(String.fromCharCode(34), '')), 0);
        assert.equal(total, 5000);
        assert.ok(csv.includes('2026-10-25 12:00:00'));
        assert.ok(csv.includes('전략 ID'));
        assert.ok(csv.includes('score'));
        assert.ok(csv.includes('전략 정보 없음'));
        assert.ok((await page.locator('#perf-export-status').textContent()).includes('2건'));
        assert.ok((await page.locator('#perf-strategies').textContent()).includes('score'));
      });
      await check('빈 월에서는 CSV 다운로드 비활성', async () => {
        await page.locator('#perf-prev').click();
        assert.equal(await page.locator('#perf-export').isDisabled(), true);
        assert.ok((await page.locator('#perf-strategies').textContent()).includes('이번 달 청산된 거래가 없습니다'));
        await page.locator('#perf-today').click();
        assert.equal(await page.locator('#perf-export').isDisabled(), false);
      });
      await check('조회 실패 중 CSV 차단 후 복구', async () => {
        fail.add('/api/trades');
        await page.evaluate(() => loadLists());
        assert.equal(await page.locator('#perf-export').isDisabled(), true);
        fail.clear();
        await page.evaluate(() => loadLists());
        assert.equal(await page.locator('#perf-export').isDisabled(), false);
      });
      await check('브라우저 오류 없음', async () => assert.deepEqual(errors, []));
      await page.close();
    }
  }
} finally { await browser.close(); }
await writeFile(resolve(out, 'result.json'), JSON.stringify({ results, failures }, null, 2));
console.log(JSON.stringify({ passed: results.length, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;