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
}) → { close(), lastPrice(market): number|null, lastAt(market): number|null, status(): string }

2026-10-23 계약 C8 보강: stale은 연결 단위, 재연결 후 `onStatus('open', { reconnect: true })`, 역순 체결은 `lastPrice` 미갱신, 같은 `sequential_id`는 한 번만 전달 (최근 1,000개). `CONTRACTS.md` C8 참고.
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

- 2026-10-23: [공식 연결 관리](https://apidocs.bithumb.com/reference/연결-관리)의 약 120초 무통신 종료에 대비해 기본 30초마다 ws PING 프레임 또는 native WebSocket의 PING 문자열을 보냅니다. PONG/UP도 연결 생존 응답으로 취급합니다. 종목별 시세 신선도는 lastAt으로 별도 확인해야 합니다.
- [공식 체결 예제](https://apidocs.bithumb.com/reference/체결-trade)의 sequential_id가 안전한 정수 범위를 초과하므로 JSON 숫자 토큰의 정밀도를 보존한 뒤 종목+ID로 최근 1,000개를 중복 제거합니다. 재연결해도 이 기록은 유지합니다.
- 기본 연결 제한 10초(timeoutMs), pingIntervalMs 옵션을 추가했습니다. 빈 markets는 연결하지 않습니다. 설정 오류는 생성 시 검출하고 네트워크/사용자 콜백 오류는 격리합니다.
- 타이머 정리와 연결 세대 검사를 통해 종료/재연결 이후 도착한 비동기 Blob 결과를 버립니다. 역순 체결은 콜백에 전달하되 최신 가격 캐시를 덮어쓰지 않습니다.
- C9 허용에 따라 ws ^8.22.0 및 잠금 파일을 추가했습니다. 설정 키와 매매 루프 연결은 T-008에서 진행합니다.

## 작업 로그

- 2026-10-23 Codex: src/bithumb/ws.js 및 가짜 WebSocket 기반 test/ws.test.js 구현. 전용 20개 및 npm test 전체 109개 통과(실패/취소/건너뜀 0).
- V4: 실제 공개 BTC·ETH 스트림을 65,009ms 연결해 체결 141건 수신. open 1회, closed/stale 오류 0회, 종료 후 status=closed. 마지막 BTC 108,936,000원 / ETH 3,206,000원. 15/30/45/60초 누적 수신 18/64/128/135건. 공개 시세만 조회했습니다.
- 샌드박스 네트워크 제한으로 첫 연결 시도는 실패했습니다. 네트워크 승인 후 같은 검증을 재실행해 위 결과를 확인했습니다.
- V1 범위: 구독, 바이너리 형식, 큰 ID 정밀도, 중복/역순, 백오프/초기화, stale/PONG, 연결 제한, 늦은 Blob, 오류 격리, native fallback, 생성자 실패, 콜백 내 종료, 종료 후 재연결 차단.
- V3 실시간 모의투자 연결 검증은 T-008 연결 이후 필요합니다. 현재 구현/단위 및 실제 서비스 검증을 마치고 Claude 리뷰 대기로 넘깁니다.
## 리뷰

- (Claude)
