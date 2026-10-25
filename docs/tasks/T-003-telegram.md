# T-003 텔레그램 알림 모듈

- 담당: Codex · 상태는 `BOARD.md` 참고
- 선행: T-000
- 연결: T-008 (Claude)

## 목표

매수·매도·손절가 변경·오류·킬 스위치 같은 이벤트(C2)를 텔레그램으로 보낸다. 집 PC에서 돌기 때문에 사용자가 밖에서 상황을 아는 유일한 수단이다.

## 수정하는 파일

- 새로 만듦: `src/notify/telegram.js`, `test/telegram.test.js`, `docs/setup/telegram.md`

## 인터페이스 (`CONTRACTS.md` C6)

```js
export function createTelegramNotifier({
  token, chatId,
  types = ['buy', 'sell', 'close', 'stop', 'error', 'kill', 'pause', 'resume', 'ops'],
  fetchImpl = globalThis.fetch,
  onError = () => {},
  minIntervalMs = 1000,   // 메시지 사이 최소 간격
  maxQueue = 50,
  prefix = '[AST]',
}) → { notify(event), flush(): Promise<void>, enabled: boolean }

export function formatEvent(event, { prefix }) → string
```

## 동작

- `token`이나 `chatId`가 비어 있으면 `enabled=false`, `notify`는 아무것도 하지 않는다.
- `types`에 없는 이벤트는 보내지 않는다.
- 전송: `POST https://api.telegram.org/bot{token}/sendMessage`, JSON `{ chat_id, text, disable_web_page_preview: true }`.
- 메시지 형식 (KST):
  ```
  [AST] 매수 · 10-23 16:00
  매수 109,128,000원 × 0.00916 · 손절가 106,200,000 · 1차 목표 115,000,000 · 2차 목표 120,800,000
  ```
  타입 라벨: buy 매수, sell 매도, close 청산, stop 손절가 변경, error 오류, kill 킬 스위치, pause 일시정지, resume 재개, ops 운영, skip 진입 보류, start 시작.
- 순서대로 하나씩 보낸다 (큐). `minIntervalMs` 간격을 지킨다.
- HTTP 429면 응답의 `parameters.retry_after`초 뒤 한 번 재시도한다.
- 큐가 `maxQueue`를 넘으면 가장 오래된 것을 버리고 `onError`로 알린다.
- **절대 예외를 던지지 않는다.** 실패는 `onError(err)`로 넘긴다.
- 같은 `error` 메시지가 1분 안에 반복되면 한 번만 보낸다 (오류 폭주 방지).
- `flush()`는 큐가 빌 때까지 기다린다 (테스트와 종료용).

## 테스트 (가짜 `fetchImpl`)

- 비활성 상태에서는 요청하지 않는다
- 타입 필터
- 메시지 형식 (KST 시각, 라벨)
- 순서 보장, 간격 (`minIntervalMs: 0`으로 빠르게 테스트 가능하게)
- 429 재시도
- 네트워크 오류 시 예외 없이 `onError` 호출
- 같은 오류 반복 억제

## 문서 `docs/setup/telegram.md`

BotFather로 봇 만들기 → 토큰 받기 → 봇에게 메시지 보내기 → `getUpdates`로 chat id 확인. 사용자가 그대로 따라 할 수 있게 한국어로.

## 설정 키 (제안)

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_TYPES`(쉼표 구분)

## 완료 기준

- `npm test` 전체 통과
- 실제 토큰 없이도 모든 테스트가 돈다

## 결정 사항

- C3 종료 계약에 따라 `close()`, `flush({ timeoutMs })`, 생성자 `timeoutMs`(기본 10000)를 추가. 기존 `flush()`는 제한 없이 완료 대기하며 제한시간 초과는 onError 후 resolve. close 후 새 요청/결과 콜백 금지.
- 전송 순서와 시작 간 최소 간격을 유지. 대기열 상한은 전송 중인 1건 제외, 초과 시 가장 오래된 대기 건 제거. 대기열은 메모리에만 보관.
- HTTP 429는 retry_after 이후 1회 재시도, 두 번째 429의 대기시간도 다음 메시지에 적용. 네트워크·기타 HTTP 오류는 자동 재시도하지 않음.
- 같은 error.msg는 이벤트 at가 아닌 수신 시각으로 60초 억제. onError 동기 예외/비동기 rejection 격리, 토큰 마스킹 적용.
- 공식 API에 명시된 `link_preview_options: { is_disabled: true }`를 수정안에 사용. 위 명세의 구형 필드와 차이를 MESSAGES.md에 보고했고 Claude 리뷰 요청 상태. 공용 계약은 수정하지 않음.
- 텍스트는 KST/한국어 라벨/원본 msg, 최대 4096 UTF-16 코드 유닛으로 생략 표시. HTML/Markdown 해석은 사용하지 않음.
- fetch와 응답 본문 모두 제한시간 적용, AbortSignal을 무시하는 가짜 fetch도 Promise.race로 대기 종료. 백그라운드 타이머 unref, 명시적 flush 동안 ref하여 정상 종료 대기.

## 작업 로그

- 2026-10-23 Codex: `src/notify/telegram.js`, `test/telegram.test.js`, `docs/setup/telegram.md` 작성.
- 전용 테스트 19개 통과. 순서/간격, 429 재시도, 큐 초과, 반복 오류 억제, 네트워크/API/본문 실패, close/flush, 오류 처리기 실패, Store 구독 연결, 자식 프로세스 종료까지 가짜 fetch로 검증.
- 전체 npm test 89/89 통과 (T-004 포함). 실제 토큰이나 외부 발송 없이 실행.
- V4 실제 Telegram 수신 확인 미실시: 봇·수신자 설정과 실제 발송 지시가 필요. 설정/수동 확인 절차를 docs/setup/telegram.md에 작성. V3는 T-008 연결 후 확인 대상.
- API 필드 변경안을 포함해 Claude 리뷰 요청. V4 미실시를 완료로 처리하지 않음.

## 리뷰

- (Claude)
