import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Trader } from '../src/trader.js';
import { Store } from '../src/store.js';
import { PaperBroker } from '../src/broker/paper.js';
import { buildConfig } from '../src/config.js';

async function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'ast-reentry-'));
  t.after(() => fs.rmSync(dir,{recursive:true,force:true}));
  const cfg = buildConfig({ LOSS_COOLDOWN_BARS:'6', REGIME_FILTER:'off', FEE_RATE:'.0004', MIN_RR:'1' });
  const d = Array.from({length:200},(_,i)=>{const c=100000+i*100;return {t:i*14400000,o:c-100,c,h:c+800,l:c-800,v:100};});
  const client = { async ticker(){return {price:d.at(-1).c};}, async candles(){return d;}, async candlesRange(){return d;} };
  const create = () => {
    const store = new Store(dir);
    return new Trader({cfg,client,store,broker:new PaperBroker(store,cfg),now:()=>200*14400000+3001,log:()=>{}});
  };
  const trader = create(); await trader.init(); await trader.enter();
  assert.ok(trader.state.position);
  return {trader,create,cfg};
}

test('손실 청산 때만 대기 시작, 재시작 후에도 주문 차단·만료 후 허용', async t => {
  const x = await setup(t), p = x.trader.state.position;
  await x.trader.sell({qty:p.qty,reason:'검증 손절',kind:'stop'},p.entryPrice*.98);
  const signalAt=x.trader.state.lastCandleT;
  assert.equal(x.trader.state.lastLossSignalAt,signalAt);
  const restored=x.create(); await restored.init(); await restored.enter();
  assert.equal(restored.state.position,null);
  assert.match(restored.store.events(1)[0].msg,/재진입 대기/);
  restored.candles=restored.candles.map(b=>({...b,t:b.t+6*14400000}));
  await restored.enter(); assert.ok(restored.state.position);
});

test('수익 청산은 손실 재진입 대기를 만들지 않음', async t => {
  const x=await setup(t),p=x.trader.state.position;
  await x.trader.sell({qty:p.qty,reason:'검증 익절',kind:'t2'},p.entryPrice*1.05);
  assert.equal(x.trader.state.lastLossSignalAt,undefined);
  await x.trader.enter(); assert.ok(x.trader.state.position);
});
