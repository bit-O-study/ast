# T-033 모의투자 실시간 검증·설정 즉시 변경

사용자 요청(2026-10-27): "지금부터 하루 동안 실시간으로 검증", "검증하는 것과 실시간으로 변경하는 것을 모의투자 기능으로 설계하고 만들어 달라". 범위는 사용자가 셋 다 고름: 실시간 검증 화면, 설정 실시간 변경, 검증 결과 자동 반영.

배경: T-027에서 수수료·1회 매수 금액을 바꾸려면 서버 `.env`를 고치고 매매 프로세스를 재기동해야 했다. 원격 명령 실수로 약 2분 정지가 생겼다. V3(실시간 모의투자) 검증도 사람이 서버 로그를 직접 봐야 했다.

## 수정하는 파일
- 신규: src/settings.js, src/verify/live.js, web/verify.js, test/settings.test.js, test/live-verify.test.js
- 수정: src/trader.js(설정 적용 시점·체결 이벤트 필드), src/server.js(API), src/index.js(연결), web/index.html, web/app.js(탭), web/style.css
- scripts/check-dashboard.mjs(4번째 탭 반영·검증 탭 점검)
- docs/collab/CONTRACTS.md(API 추가), docs/tasks/T-033, BOARD/MESSAGES/VERIFY

## 설계

### 1. 설정 즉시 변경 (`src/settings.js`)
- **MODE=paper에서만 동작한다.** live에서는 API가 거부하고, 저장된 변경값도 적용하지 않는다.
- 바꿀 수 있는 값은 진입과 체결에만 영향을 주는 5개로 제한한다. 손절·목표 규칙을 보유 중에 바꾸면 백테스트와 실매매 규칙이 어긋나므로 제외한다.

| 키 | .env | 범위 |
|---|---|---|
| fee | FEE_RATE | 0 ~ 0.01 |
| slip | SLIPPAGE | 0 ~ 0.01 |
| maxPositionKrw | MAX_POSITION_KRW | MIN_ORDER_KRW ~ 모의자금, 정수 |
| risk | RISK_PER_TRADE | 0 초과 ~ 1 |
| entryScore | ENTRY_SCORE | 0 ~ 100 |

- **적용 시점:** 포지션이 없으면 즉시 적용한다. 보유 중이면 "대기"로 두고, 청산된 뒤 첫 tick에 적용한다. 진입 수수료와 청산 수수료가 섞이지 않게 하기 위해서다.
- 모든 요청은 한 번에 검증하고 적용한다. 하나라도 틀리면 전부 거부한다.
- **저장:** `state.settings = { overrides, pending, history }`. 재기동 후에도 유지되며, `.env`보다 우선한다. "되돌리기"를 누르면 시작 시점의 `.env` 값으로 돌아간다.
- **기록:** 이벤트 `config`에 변경 전·후 값과 적용 시점을 남긴다. 화면에는 최근 20건을 보여 준다.

### 2. 실시간 검증 (`src/verify/live.js`)
- 대시보드의 시작 버튼(기본 24시간, 1~168시간)으로 세션을 만든다. 세션은 `state.liveVerify`에 저장되므로 재기동 후에도 이어진다. 동시에 하나만 진행한다. paper 전용이다.
- 매 tick마다 아래 항목을 점검한다. 필요한 값은 이벤트와 Trader 상태에서 계산하며, 매매 판단에는 영향을 주지 않는다.

| 점검 | 실패 조건 |
|---|---|
| 모의투자 모드 | mode ≠ paper |
| 매매 루프 연속성 | 직전 tick과의 간격이 10분 초과(프로세스 중단 포함) |
| 봉 마감 처리 | 마지막으로 처리한 봉의 다음 봉이 마감된 지 10분이 지나도 처리 안 됨 |
| 매매 루프 오류 | 세션 중 `error` 이벤트 발생 |
| 매수 체결 | 매수 금액 > 적용된 1회 최대 금액, 수수료 ≠ 금액×수수료율, 수량 ≠ (금액−수수료)/체결가 (상대오차 1e-6) |
| 매도 체결 | 매도 대금 ≠ 수량×체결가×(1−수수료율) |
| 손절·목표 순서 | 매수 시 손절가 < 체결가 < 1차 목표 < 2차 목표가 아님 |

- 재기동(`start` 이벤트)은 실패로 보지 않고 경고로 기록한다. 배포가 재기동을 일으키기 때문이다. 중단 시간이 10분을 넘으면 연속성 실패로 잡힌다.
- **판정:** 종료 시각까지 실패가 없고, 처리한 봉 마감이 기대 개수(시간÷봉 길이, 내림)−1 이상이면 **통과**다. 실패가 나면 그 순간 **실패**로 끝내고 경고 이벤트를 남긴다.
- **자동 반영:** 끝나면 `data/paper/verify/<id>.md` 보고서를 쓰고 `verify` 이벤트를 남긴다. 실시간 탭 상단에 결과 알림을 띄운다. 설정은 자동으로 바꾸지 않는다. 텔레그램은 아직 매매 루프에 연결되지 않아서(T-008) 화면과 이벤트로만 알린다.
- 체결 이벤트(buy/sell)에 `cost`/`proceeds`, `fee`, `feeRate`, `maxPositionKrw`를 선택 필드로 추가한다. 기존 필드는 그대로 둔다.

### 3. API (127.0.0.1 전용, 기존 /api/control과 같은 수준)
- `GET /api/settings`, `POST /api/settings {changes, reason?}`, `POST /api/settings/reset {keys}`
- `GET /api/verify`, `POST /api/verify {action:'start', hours} | {action:'stop'}`, `GET /api/verify/report`
- `/api/status`에 `verify` 요약(state, endsAt, failure)을 선택 필드로 추가한다.

### 4. 화면
"검증" 탭을 4번째로 추가한다.
- 검증 세션: 진행률, 점검 항목별 상태, 처리한 봉·체결 수, 체결 대조표, 경고·실패 사유, 보고서 보기
- 설정 변경: 현재값·`.env` 값·대기값, 변경 이력

## 완료 기준
- 설정: 범위 검증, 전부 아니면 전부, 보유 중 대기 후 청산 뒤 적용, live 거부, 재기동 후 유지, 되돌리기
- 검증: 각 실패 조건, 재기동 경고, 통과 판정, 보고서 작성, 재기동 후 이어서 진행
- 두 기능이 Trader와 함께 가짜 시세로 동작하는 통합 테스트, npm test 전체 통과
- 체결 이벤트 필드 추가로 V2가 깨지지 않을 것(npm run verify)
- 브라우저 점검(scripts/check-dashboard.mjs) 통과
- 배포 후 서버에서 24시간 세션 시작 = 이 작업의 V3

## 결정 사항
- 2026-10-27 작업 번호: Codex가 T-032를 쓰고 있어 T-033으로 잡았다.
- 2026-10-27 손절·목표 관련 값은 즉시 변경 대상에서 제외(공통 규칙 원칙).

## 작업 로그
- 2026-10-27 명세 작성.
- 2026-10-27 구현: src/settings.js, src/verify/live.js, Trader 선택 인자(settings·verifier)와 체결 대조 필드, API 6개, 검증 탭(web/verify.js). 이벤트는 파일을 다시 읽지 않고 store.onEvent 구독으로 받는다(같은 ms 매도 2건도 구분).
- V1 270/270 (settings 4, live-verify 7 추가: 대조 함수, 통과·보고서, 오류 즉시 실패, 루프 공백·봉 미처리, 재기동 이어서·경고, 보유 중 변경 대기 후 다음 매수 반영, HTTP 400/404/409).
- V2 npm run verify 1500 BTC/ETH/XRP 진입·청산 100% 일치, 오류 0.
- 브라우저 204/204 (1440/390/320 × 밝음/어두움): 4번째 탭 키보드 순환, 검증 시작·중단, 체결 대조, % 입력 → 소수 전송, 빈 입력 거부, 실시간 탭 실패 알림. 모바일 가로 넘침(grid 최소 폭) 수정. playwright-core는 임시 폴더에 설치해 실행했고 프로젝트 의존성에는 추가하지 않음.
- CONTRACTS.md C2(config·verify 이벤트, 체결 선택 필드)와 C10 추가.

