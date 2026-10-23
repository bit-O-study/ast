# 공용 인터페이스 (계약)

여러 작업이 함께 쓰는 데이터 형식과 모듈 인터페이스입니다. **Claude만 수정**합니다. 변경이 필요하면 `MESSAGES.md`에 제안하세요.

마지막 수정: 2026-10-23 (Claude)

---

## C1. 캔들

```js
{ t, o, h, l, c, v, value }
// t: 봉 시작 시각 (UTC ms), o/h/l/c: 원, v: 거래량(코인), value: 거래대금(원)
```

- 배열은 항상 **오래된 → 최신** 순서입니다.
- 매매 판단에는 **마감된 봉만** 씁니다. 마감 여부: `t + unit*60000 <= now`.
- 빗썸 원본 → 이 형식 변환은 `src/bithumb/client.js`의 `mapCandle`을 씁니다.

## C2. 이벤트

매매 루프에서 일어난 일은 모두 이벤트 하나로 기록됩니다.

```js
{ at, type, msg, ...추가필드 }
// at: UTC ms, type: 아래 표, msg: 사람이 읽을 한국어 한 줄
```

| type | 언제 |
|---|---|
| `start` | 매매 루프 시작 |
| `buy` | 매수 체결 |
| `sell` | 매도 체결 (일부 매도 포함) |
| `close` | 포지션 전량 청산, 성공·실패 확정 |
| `stop` | 손절가 변경 |
| `skip` | 매수 신호가 있었지만 진입하지 않음 |
| `error` | 오류 |
| `kill` | 킬 스위치 작동 |
| `pause` / `resume` | 신규 진입 일시정지 / 재개 |
| `ops` | 운영 상태 변화 (IP 변경, 시세 연결 끊김·복구 등) — T-004, T-005가 사용 |

구독: `store.onEvent(fn)` → 이벤트가 기록될 때마다 `fn(event)` 호출. 해제 함수를 돌려줍니다. 구독 함수가 예외를 던져도 매매 루프는 멈추지 않습니다.

## C3. 모듈 설계 원칙

- Codex가 만드는 모듈은 **설정을 생성자/팩토리 인자로 받습니다.** `process.env`를 직접 읽지 않습니다.
- `.env` 키 추가, `src/config.js`, `src/index.js`, `src/trader.js` 연결은 **Claude가 연결 작업(T-008)에서** 합니다. 각 명세의 "설정 키(제안)"에 필요한 키를 적어 두세요.
- 네트워크를 쓰는 모듈은 `fetchImpl`(또는 `WebSocketImpl`)을 주입받아 테스트에서 가짜로 바꿀 수 있어야 합니다.
- 타이머를 쓰는 모듈은 `stop()`/`close()`로 정리할 수 있어야 하고, 테스트가 끝나지 않고 걸리지 않아야 합니다 (`timer.unref()` 권장).
- 외부 서비스 오류는 매매를 멈추게 하면 안 됩니다. 알림·감시 모듈은 예외를 던지지 말고 `onError`로 넘깁니다.

## C4. 전략 인터페이스 (T-001에서 확정)

```js
// src/strategies/<id>.js
export default {
  id: 'score',            // STRATEGY 설정값
  name: '지표 점수',
  minBars: 60,            // 판단에 필요한 최소 마감 봉 수
  prepare(d) { return { d, I, ... }; },  // 지표 계산 (한 번). I는 indicators(d) 결과 — 손절가 계산에 atr, s20을 씀
  evaluate(ctx, i, cfg) {                // i번째 마감 봉에서 판단
    return { enter, score, parts, trend, adx, rsi, note };
    // enter: 진입 여부(boolean), score: -100~100 (화면 표시), note: 판단 이유 한 줄
  },
};
```

- 등록: `src/strategies/index.js`의 `STRATEGIES`. 설정 `STRATEGY=<id>`.

- 손절가·목표가는 전략이 아니라 `src/strategy.js`의 `planEntry`와 `src/position.js`가 공통으로 정합니다.
- 시장 국면 필터는 `src/regime.js`: `buildRegime(btcCandles, cfg)` → `{ enabled, isBull(T), state(T) }`. `T`는 **판단 봉의 마감 시각**(`t + unit*60000`). 꺼져 있으면 `isBull`은 항상 `true`, `state`는 `null`.
- 백테스트에서 BTC가 아닌 코인은 `loadBacktestData(client, cfg, count)`로 BTC 시세를 함께 받아 `backtest(d, cfg, { btc })`에 넘깁니다.

## C5. 캔들 저장소 (T-002)

```js
import { CandleStore } from './data/candleStore.js';
const cs = new CandleStore({ dir: 'data/candles', client });
await cs.update('KRW-BTC', 240, { minBars: 3000 }); // 부족한 과거분과 새 봉을 받아 저장, 마감 봉만
const d = cs.load('KRW-BTC', 240);                   // C1 배열, 파일 없으면 []
```

## C6. 알림 (T-003)

```js
import { createTelegramNotifier } from './notify/telegram.js';
const n = createTelegramNotifier({ token, chatId, types: ['buy','sell','close','stop','error','kill','ops'], fetchImpl, onError });
store.onEvent((e) => n.notify(e)); // 연결은 T-008
```

## C7. 운영 감시 (T-004)

```js
import { startHeartbeat } from './ops/heartbeat.js';
import { createIpWatcher } from './ops/ipWatcher.js';
const hb = startHeartbeat({ url, intervalSec: 60, fetchImpl, onError }); hb.stop();
const ip = createIpWatcher({ intervalSec: 300, fetchImpl, onChange: (prev, next) => {}, onError }); ip.stop();
```

## C8. 실시간 체결가 (T-005)

```js
import { createTradeStream } from './bithumb/ws.js';
const s = createTradeStream({ markets: ['KRW-BTC'], onTrade: ({ market, price, at }) => {}, onStatus: (status, info) => {}, WebSocketImpl });
// status: 'open' | 'closed' | 'stale'(일정 시간 체결 없음)
s.close();
```

## C9. 의존성 예외

- `ws` 패키지: Node 20에는 기본 WebSocket이 없어 T-005에서 추가를 허용합니다. `globalThis.WebSocket`이 있으면 그것을 먼저 씁니다.
- 그 밖의 패키지는 추가 전에 `MESSAGES.md`로 합의합니다.
