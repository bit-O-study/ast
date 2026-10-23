# T-004 생존 감시 + 공인 IP 변경 감지

- 담당: Codex · 상태는 `BOARD.md` 참고
- 선행: T-000
- 연결: T-008 (Claude)
- 근거: `docs/PLAN.md` §8 (집 PC 운영)

## 목표

1. **생존 감시**: 프로그램이 살아 있다는 신호를 외부 감시 서비스(healthchecks.io 등)에 주기적으로 보낸다. PC가 꺼지거나 프로그램이 멈추면 신호가 끊기고, 감시 서비스가 사용자 휴대폰으로 알린다.
2. **공인 IP 변경 감지**: 가정용 인터넷의 공인 IP가 바뀌면 빗썸 API 허용 IP와 달라져 주문이 막힌다. 바뀌는 순간 알아챈다.

## 수정하는 파일

- 새로 만듦: `src/ops/heartbeat.js`, `src/ops/ipWatcher.js`, `test/ops.test.js`, `docs/setup/healthchecks.md`

## 인터페이스 (`CONTRACTS.md` C7)

```js
export function startHeartbeat({ url, intervalSec = 60, fetchImpl = globalThis.fetch, onError = () => {}, timeoutMs = 10000 })
  → { ping(): Promise<boolean>, fail(message): Promise<boolean>, stop(), enabled: boolean }

export function createIpWatcher({
  intervalSec = 300,
  sources = ['https://api.ipify.org', 'https://ifconfig.me/ip'],
  fetchImpl = globalThis.fetch, onInitial = (ip) => {}, onChange = (prev, next) => {}, onError = () => {}, timeoutMs = 10000,
}) → { check(): Promise<string|null>, current(): string|null, stop() }
```

## 동작

### 생존 감시
- `url`이 비어 있으면 `enabled=false`, 아무것도 하지 않는다.
- 시작 즉시 한 번, 이후 `intervalSec`마다 `GET url`.
- `fail(message)`: `POST {url}/fail`, 본문에 메시지 (healthchecks.io 규격). 킬 스위치나 치명적 오류 때 T-008에서 호출.
- 요청 타임아웃(`AbortController`), 실패해도 예외 없이 `onError`.
- 타이머는 `unref()`.

### IP 감시
- `sources`를 순서대로 시도해 첫 성공 값을 쓴다. 응답 본문을 다듬어(trim) IPv4/IPv6 형식인지 확인한다.
- 처음 얻은 값은 기준값으로 저장하고 `onInitial(ip)`을 부른다. `onChange`는 부르지 않는다. (2026-10-23 계약 C7 변경)
- 이후 값이 바뀌면 `onChange(prev, next)`.
- 모든 소스 실패 시 `onError`, 기존 값 유지.
- 타이머는 `unref()`.

## 테스트 (가짜 `fetchImpl`, 가짜 타이머 또는 짧은 간격)

- 비활성 생존 감시는 요청하지 않는다
- ping 주기, fail 경로·본문
- 타임아웃·네트워크 오류에서 예외 없음
- IP: 첫 값은 onChange 없음, 변경 시 onChange, 형식이 이상한 응답은 무시하고 다음 소스 시도
- `stop()` 후에는 더 요청하지 않는다

## 문서 `docs/setup/healthchecks.md`

healthchecks.io 가입 → 체크 만들기(Period 2분, Grace 3분 권장) → ping URL 복사 → 휴대폰 알림 연결(텔레그램 또는 이메일). 한국어로.

## 설정 키 (제안)

`HEARTBEAT_URL`, `HEARTBEAT_SEC`, `IP_WATCH_SEC`

## 완료 기준

- `npm test` 전체 통과, 테스트가 걸리지 않고 끝남

## 결정 사항

-

## 작업 로그

-

## 리뷰

- (Claude)
