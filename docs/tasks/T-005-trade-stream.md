# T-005 실시간 체결가 WebSocket

- 담당: Codex · 상태는 `BOARD.md` 참고
- 선행: T-000
- 연결: T-008 (Claude) — 손절가 감시를 5초 주기 REST에서 실시간 체결가로 바꾼다

## 목표

빗썸 공개 WebSocket의 체결(trade) 스트림으로 실시간 가격을 받는다. 연결이 끊기거나 체결이 멈추면 자동으로 다시 연결하고 상태를 알린다.

## 수정하는 파일

- 새로 만듦: `src/bithumb/ws.js`, `test/ws.test.js`
- 수정: `package.json`의 `dependencies`에 `ws` 추가 (CONTRACTS C9 예외 승인), `package-lock.json` 생성

## 빗썸 사양 (2026-10-23 문서 확인)

- 주소: `wss://ws-api.bithumb.com/websocket/v1`
- 연결 요청 제한: IP당 초당 10회. 넘으면 429, 계속 넘으면 약 10분 차단 → **재연결 간격을 반드시 둔다**
- 구독 요청:
  ```json
  [{ "ticket": "ast-<랜덤>" }, { "type": "trade", "codes": ["KRW-BTC"], "isOnlyRealtime": true }, { "format": "DEFAULT" }]
  ```
  `codes`는 대문자.
- 응답 필드(DEFAULT): `type`, `code`, `trade_price`, `trade_volume`, `ask_bid`, `trade_timestamp`, `timestamp`, `sequential_id`, `stream_type`
- 메시지가 바이너리(Buffer/Blob)로 올 수 있다 → 문자열로 디코드 후 JSON 파싱
- **확인 필요**: 연결 유지(ping) 규칙과 유휴 타임아웃은 `https://apidocs.bithumb.com/reference/연결-관리.md`에서 확인하고 "결정 사항"에 적어 주세요.

## 인터페이스 (`CONTRACTS.md` C8)

```js
export function createTradeStream({
  markets,                      // ['KRW-BTC', ...]
  onTrade = ({ market, price, volume, at }) => {},
  onStatus = (status, info) => {},   // 'open' | 'closed' | 'stale'
  WebSocketImpl,                // 기본: globalThis.WebSocket ?? ws 패키지
  url = 'wss://ws-api.bithumb.com/websocket/v1',
  staleMs = 60000,              // 이 시간 동안 메시지 없으면 'stale' 알리고 재연결
  backoffMs = [1000, 2000, 5000, 10000, 30000],
}) → { close(), lastPrice(market): number|null, status(): string }
```

## 동작

- 연결되면 구독 요청을 보내고 `onStatus('open')`.
- 체결 메시지마다 `onTrade({ market: code, price: trade_price, volume: trade_volume, at: trade_timestamp })`, 마지막 가격 저장.
- 끊기면 `onStatus('closed', { code, reason })`, `backoffMs` 순서대로 기다렸다 재연결 (끝까지 가면 마지막 값 반복). 연결에 성공하면 백오프 초기화.
- `staleMs` 동안 메시지가 없으면 `onStatus('stale')` 후 소켓을 닫고 재연결.
- `close()` 후에는 재연결하지 않는다. 모든 타이머 정리.
- 파싱 실패 메시지는 무시한다 (예외 없음).

## 테스트 (가짜 WebSocket 클래스 주입)

- 연결 시 구독 요청 내용
- 문자열·Buffer 메시지 모두 처리, `onTrade` 값 변환
- 끊김 → 백오프 후 재연결, 연결 성공 시 백오프 초기화
- stale 감지 후 재연결
- `close()` 후 재연결 없음, 테스트가 걸리지 않고 끝남
- 네트워크 없이 동작 (실서버 연결 테스트는 별도 수동 스크립트로 해도 됨)

## 설정 키 (제안)

`PRICE_SOURCE` (`ws` | `rest`), `WS_STALE_SEC`

## 완료 기준

- `npm test` 전체 통과
- 실제 빗썸에 1분간 연결해 체결가가 들어오는지 수동 확인하고 결과를 작업 로그에 적기

## 결정 사항

-

## 작업 로그

-

## 리뷰

- (Claude)
