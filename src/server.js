import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicConfig } from './config.js';
import { backtest, loadBacktestData } from './backtest.js';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function send(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export function createServer({ cfg, trader, client, store }) {
  const btCache = new Map();
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/api/status') return send(res, 200, { ...trader.status(), config: publicConfig(cfg) });
      if (req.method === 'GET' && url.pathname === '/api/chart') return send(res, 200, trader.chart());
      if (req.method === 'GET' && url.pathname === '/api/trades') return send(res, 200, store.trades().reverse());
      if (req.method === 'GET' && url.pathname === '/api/events') return send(res, 200, store.events(80));

      if (req.method === 'GET' && url.pathname === '/api/backtest') {
        const count = Math.min(3000, Math.max(200, Number(url.searchParams.get('count')) || 1000));
        const key = `${cfg.market}:${cfg.unit}:${count}:${cfg.regimeFilter}`;
        const hit = btCache.get(key);
        let data = hit && Date.now() - hit.at < 10 * 60e3 ? hit.data : null;
        if (!data) { data = await loadBacktestData(client, cfg, count); btCache.set(key, { at: Date.now(), data }); }
        const { d, btc } = data;
        const r = backtest(d, cfg, { btc });
        return send(res, 200, {
          stats: r.stats, trades: r.trades.reverse(), skipped: r.skipped.length, strategy: r.strategy, regimeEnabled: r.regimeEnabled,
          candles: d, equity: r.equity, hold: r.hold, s20: r.I.s20, s60: r.I.s60, bbU: r.I.bbU, bbL: r.I.bbL,
          scores: r.scores.map((s) => (s ? s.score : null)), bull: r.bull,
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/control') {
        const { action } = await readJson(req);
        if (action === 'pause') trader.pause();
        else if (action === 'resume') trader.resume();
        else if (action === 'sell_all') await trader.sellAll();
        else return send(res, 400, { error: `알 수 없는 동작: ${action}` });
        return send(res, 200, { ok: true });
      }

      if (req.method === 'GET') {
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const full = path.join(WEB, path.normalize(file));
        if (full.startsWith(WEB) && fs.existsSync(full) && fs.statSync(full).isFile()) {
          res.writeHead(200, { 'content-type': TYPES[path.extname(full)] ?? 'application/octet-stream' });
          return fs.createReadStream(full).pipe(res);
        }
      }
      send(res, 404, { error: '없는 주소입니다' });
    } catch (e) {
      send(res, 500, { error: e.message });
    }
  });
}
