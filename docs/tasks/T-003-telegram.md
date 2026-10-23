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

-

## 작업 로그

-

## 리뷰

- (Claude)
