# 공용 인터페이스 (계약)

여러 작업이 함께 쓰는 데이터 형식과 모듈 인터페이스입니다. **Claude만 수정**합니다. 변경이 필요하면 `MESSAGES.md`에 제안하세요.

마지막 수정: 2026-10-23 (Claude) · Codex 검토 의견 반영 (MESSAGES.md 2026-10-23 "계약 검토 및 개발 착수")

---

## C1. 캔들

```js
{ t, o, h, l, c, v, value }
// t: 봉 시작 시각 (UTC ms), o/h/l/c: 원, v: 거래량(코인), value: 거래대금(원)
```

- 배열은 항상 **오래된 → 최신** 순서입니다.
- 매매 판단에는 **마감된 봉만** 씁니다. 마감 여부: `t + unit*60000 <= now`.
- 빗썸 원본 → 이 형식 변환은 `src/bithumb/client.js`의 `mapCandle`을 씁니다.
- **검증 책임**: 캔들을 저장하는 쪽(T-002 `CandleStore`)이 검증합니다. 모든 값이 유한 숫자, `l ≤ min(o,c)`, `h ≥ max(o,c)`, `v ≥ 0`, `t`가 `unit` 간격에 맞음. 위반 데이터는 저장하지 않고 오류로 돌려주며 기존 파일은 그대로 둡니다.
- **봉 경계**: 빗썸 분봉은 KST 자정 기준으로 정렬됩니다. 유효한 `t`는 `(t + 9시간) % (unit*60000) === 0` (240분봉은 KST 0·4·8·12·16·20시).
- **빠진 봉**: 빗썸은 체결이 없던 구간의 봉을 주지 않을 수 있습니다. 채워 넣지 않고 `gaps()`로 보고만 합니다. 지표·전략은 배열을 있는 그대로 씁니다.

## C2. 이벤트

매매 루프에서 일어난 일은 모두 이벤트 하나로 기록됩니다.

```js
{ at, type, msg, ...추가필드 }
// at: UTC ms, type: 아래 표, msg: 사람이 읽을 한국어 한 줄
```

| type | 언제 | 추가 필드 |
|---|---|---|
| `start` | 매매 루프 시작 | |
| `buy` | 매수 체결 | `positionId`, `price`, `qty`, `stop`, `t1`, `t2` |
| `sell` | 매도 체결 1건 (일부 매도 포함) | `positionId`, `price`, `qty`, `kind`(stop·t1·t2·manual·end), `remaining` |
| `close` | 포지션 전량 청산, 성공·실패 확정 | `positionId`, `result`(성공·실패), `pnl`, `pct` |
| `stop` | 손절가 변경 | `positionId`, `stop`, `stopType` |
| `skip` | 매수 신호가 있었지만 진입하지 않음 |
| `error` | 오류 |
| `kill` | 킬 스위치 작동 |
| `pause` / `resume` | 신규 진입 일시정지 / 재개 |
| `ops` | 운영 상태 변화 (IP 변경, 시세 연결 끊김·복구 등) — T-004, T-005가 사용 |
| `config` | 설정 즉시 변경 적용·대기 (T-033, paper) | `changes`({키: {from, to}}), `status`(applied·pending·applied-after-close) |
| `verify` | 실시간 검증 시작·종료 (T-033, paper) | `state`(running·passed·failed·stopped), `failure` |

- **체결 대조 선택 필드 (T-033)**: `buy`/`sell`에 `cost`(매수)·`proceeds`(매도), `fee`, `feeRate`, `maxPositionKrw`가 붙을 수 있습니다. 체결 당시 적용된 값입니다.

구독: `store.onEvent(fn)` → 이벤트가 기록될 때마다 `fn(event)` 호출. 해제 함수를 돌려줍니다. 구독 함수가 예외를 던지거나 Promise가 reject돼도 매매 루프는 멈추지 않습니다 (`test/store.test.js`).

- **sell과 close의 관계**: 포지션 하나는 `buy` 1번, `sell` 1~3번(1차 목표 일부 매도 등), 마지막 `sell` 직후 `close` 1번으로 끝납니다. 같은 `positionId`로 묶입니다.
- **positionId**: `<market>-<진입 시각 UTC ms>`
- **중복**: 한 프로세스 안에서 이벤트는 정확히 한 번 발행됩니다. 재시작해도 지난 이벤트를 다시 발행하지 않습니다. 구독자는 중복을 걱정하지 않아도 됩니다.
- **부분 체결**: 실거래 주문의 부분 체결은 브로커 안에서 합쳐 `sell` 1건으로 냅니다. 주문 단위 이벤트(주문 접수·취소·미체결)는 T-006에서 `order` 타입으로 정의합니다.
- **성공·실패**: `close.result`는 수수료·세금·슬리피지를 뺀 순손익(`pnl`)이 0원보다 크면 `성공`, 아니면 `실패`.

## C3. 모듈 설계 원칙

- Codex가 만드는 모듈은 **설정을 생성자/팩토리 인자로 받습니다.** `process.env`를 직접 읽지 않습니다.
- `.env` 키 추가, `src/config.js`, `src/index.js`, `src/trader.js` 연결은 **Claude가 연결 작업(T-008)에서** 합니다. 각 명세의 "설정 키(제안)"에 필요한 키를 적어 두세요.
- 네트워크를 쓰는 모듈은 `fetchImpl`(또는 `WebSocketImpl`)을 주입받아 테스트에서 가짜로 바꿀 수 있어야 합니다.
- 타이머를 쓰는 모듈은 `stop()`/`close()`로 정리할 수 있어야 하고, 테스트가 끝나지 않고 걸리지 않아야 합니다 (`timer.unref()` 권장).
- 외부 서비스 오류는 매매를 멈추게 하면 안 됩니다. 알림·감시 모듈은 예외를 던지지 말고 `onError`로 넘깁니다. `onError` 자체가 던지는 예외도 모듈 안에서 삼킵니다.
- **이 격리 원칙은 알림·감시 모듈에만 적용**됩니다. 시세 조회 실패나 주문 결과를 알 수 없는 경우(응답 유실 등)의 처리, 신규 주문 중단, 재시도 정책은 T-006에서 별도로 정의합니다.
- **종료**: `stop()`/`close()` 후에는 새 요청을 시작하지 않습니다. 진행 중인 요청은 타임아웃(기본 10초)까지 끝나게 두되 결과 콜백은 부르지 않습니다. 알림 모듈은 종료 전에 `flush({ timeoutMs })`로 대기열을 비울 기회를 줍니다.
- 모든 네트워크 요청에는 타임아웃(기본 10초, `AbortController`)이 있어야 합니다.

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
const ip = createIpWatcher({ intervalSec: 300, fetchImpl, onInitial: (ip) => {}, onChange: (prev, next) => {}, onError }); ip.stop();
```

- 처음 얻은 IP는 `onInitial(ip)`으로 알립니다 (`onChange` 아님). T-008에서 시작 시 `ops` 이벤트로 한 번 기록해, 사용자가 빗썸 허용 IP와 대조할 수 있게 합니다.

## C8. 실시간 체결가 (T-005)

```js
import { createTradeStream } from './bithumb/ws.js';
const s = createTradeStream({ markets: ['KRW-BTC'], onTrade: ({ market, price, at }) => {}, onStatus: (status, info) => {}, WebSocketImpl });
// status: 'open' | 'closed' | 'stale'(일정 시간 체결 없음)
s.close();
```

- **stale 기준은 연결 단위**입니다. 구독한 모든 종목을 통틀어 `staleMs` 동안 메시지가 하나도 없으면 `stale` → 재연결. 거래가 드문 코인 때문에 연결을 끊지 않기 위해서입니다. 종목별 최신성은 `lastAt(market)`으로 제공하고, 오래된 종목은 T-008에서 REST로 보완합니다.
- **복구 신호**: 재연결 후 구독까지 끝나면 다시 `onStatus('open', { reconnect: true })`.
- **재구독**: 연결될 때마다 구독 요청을 다시 보냅니다.
- **역순·중복 체결**: 종목별로 `trade_timestamp`가 마지막 값보다 이전인 체결은 `lastPrice`를 갱신하지 않습니다. 같은 `sequential_id`는 한 번만 `onTrade`로 넘깁니다 (최근 1,000개 기억).
- `close()` 이후에는 어떤 경우에도 재연결하지 않습니다.

## C10. 설정 즉시 변경·실시간 검증 (T-033, MODE=paper 전용)

- 설정: `src/settings.js`의 `Settings`. 바꿀 수 있는 키는 `fee`, `slip`, `maxPositionKrw`, `risk`, `entryScore`뿐입니다. 손절·목표 규칙은 바꿀 수 없습니다. 포지션 보유 중 요청은 청산 뒤 첫 tick에 적용합니다. 변경값은 `state.settings.overrides`에 저장되며 `.env`보다 우선합니다. live에서는 적용하지 않습니다.
- 검증: `src/verify/live.js`의 `LiveVerifier`. 세션은 `state.liveVerify`에 저장합니다. 매매 판단에 관여하지 않고 이벤트와 Trader 상태만 읽습니다.
- Trader 연결: 생성자 선택 인자 `settings`, `verifier`. 없으면 기존 동작과 같습니다.
- API: `GET/POST /api/settings`, `POST /api/settings/reset`, `GET/POST /api/verify`, `GET /api/verify/report`. 기능이 없으면 404, 잘못된 값은 400, 이미 진행 중이면 409입니다. `/api/status`에 선택 필드 `verify`(요약)가 붙습니다.

## C9. 의존성 예외

- `ws` 패키지: Node 20에는 기본 WebSocket이 없어 T-005에서 추가를 허용합니다. `globalThis.WebSocket`이 있으면 그것을 먼저 씁니다.
- 그 밖의 패키지는 추가 전에 `MESSAGES.md`로 합의합니다.
