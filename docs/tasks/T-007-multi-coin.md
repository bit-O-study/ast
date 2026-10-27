# T-007 다중 코인 동시 운용 + 계좌 단위 위험 한도

사용자 결정(2026-10-27): "3종목 200만으로 만들어줘". 근거는 T-037이다. BTC·ETH·XRP × 1회 200만원 구성이 7구간 합계 +106.5%, 최악 MDD 12.1%로, 현재(BTC 300만) +43.9%/9.7%보다 수익/MDD가 두 배 높다.

## 수정하는 파일
- 신규: src/portfolio.js, test/portfolio.test.js
- 수정: src/config.js(MARKETS), src/index.js, src/trader.js(계좌 단위 위험 위임·이벤트 market 필드), src/broker/paper.js(공유 지갑), src/server.js(?market=, 포트폴리오 요약), src/verify/live.js(여러 종목 점검), src/settings.js(여러 cfg 동기화), src/notify/kakao.js(종목 표시)
- web/index.html, web/app.js, web/style.css, scripts/check-dashboard.mjs
- scripts/deploy/deploy-paper.ps1(포트폴리오 포지션 배포 차단), test/deploy*.test.js
- docs/collab/CONTRACTS.md, docs/tasks/T-007, BOARD/MESSAGES/VERIFY, .env.example

## 설계
- `MARKETS=KRW-BTC,KRW-ETH,KRW-XRP`이 있으면 포트폴리오 모드다. 없으면 `MARKET` 한 종목으로 지금과 똑같이 동작한다. 포트폴리오 모드는 **MODE=paper 전용**이다.
- **종목별 Trader:** 종목마다 Trader가 하나씩 돈다. 전략·진입·청산 규칙은 종목별로 지금과 같은 함수를 쓴다(백테스트 = 실매매 원칙 유지). 종목별 cfg는 기본 cfg를 복사하고 `market`만 바꾼다. 설정 즉시 변경은 모든 cfg에 함께 반영한다.
- **저장소:** 첫 종목(KRW-BTC)은 기존 `data/paper`를 그대로 쓴다. 기존 거래·이벤트·검증 세션이 유지된다. 나머지는 `data/paper/<종목>`에 저장한다.
- **공유 지갑:** 모의 현금 하나를 모든 종목이 같이 쓴다. `data/paper/state.json`의 `paper.krw`가 공유 현금이다. 첫 종목 코인은 기존 `paper.coin`에, 나머지는 `paper.coins[종목]`에 둔다. 한 파일이므로 원자적으로 저장된다.
- **계좌 단위 위험 (`src/portfolio.js`):**
  - 평가금액 = 공유 현금 + Σ 종목 코인 × 현재가
  - 일일 손실 한도와 킬 스위치는 이 계좌 평가금액 기준이다. 킬 스위치가 작동하면 모든 종목을 전량 매도하고 정지한다.
  - 진입 크기의 위험 계산(RISK_PER_TRADE)도 계좌 평가금액 기준이다. 1회 상한은 MAX_POSITION_KRW=2,000,000이다.
  - 일시정지·재개·전량 매도는 모든 종목에 함께 적용한다.
- **이벤트:** 모든 이벤트에 `market` 선택 필드를 붙인다. 카카오 알림 첫 줄에 종목 이름을 표시한다.
- **실시간 검증:** 기존 세션(첫 종목 저장소)을 그대로 이어 간다. 모든 종목의 이벤트를 구독하고, 봉 마감 처리는 종목별로 점검한다.
- **API:** `/api/status|chart|trades|events`에 `?market=` 선택 인자를 둔다. 기본은 첫 종목이다(배포·점검 스크립트 호환). `/api/status`에 `portfolio`(평가금액, 현금, 종목별 보유·평가손익) 선택 필드를 둔다. `/api/trades`는 market이 없으면 전 종목을 합친다(성과 탭).
- **배포 보호:** deploy-paper.ps1은 `portfolio.markets` 중 하나라도 포지션이 있으면 배포를 멈춘다.
- **화면:** 상단에 종목 선택 버튼을 두고, 실시간 탭에 포트폴리오 요약 패널을 둔다.

## 완료 기준
- 공유 현금·코인 분리, 계좌 평가금액, 일일 한도, 킬 스위치 전 종목 매도, 설정 동기화, 단일 종목 모드 불변을 테스트한다.
- npm test 전체 통과, V2 3종목 리플레이 통과(종목별 규칙 불변), 브라우저 점검 통과
- 배포 후 실시간 검증으로 V3 확인. 진행 중인 24시간 세션(~10-28 11:18) 종료 후 배포한다.

## 결정 사항
- 2026-10-27 첫 종목 저장소 경로 유지(기존 기록 보존). 포트폴리오 모드 paper 전용.

## 작업 로그
- 2026-10-27 명세 작성.
- 2026-10-27 구현: config MARKETS, PaperBroker 공유 지갑, src/portfolio.js(계좌 평가금액·일일 한도·킬 스위치·일시정지), Trader portfolio 위임·이벤트 market, Settings mirrors, LiveVerifier 종목별 봉 점검(기존 세션 필드 이어 쓰기), API ?market=·portfolio, 화면 종목 선택·포트폴리오 패널, 카카오 종목 표시, 배포 차단 확장.
- 검증: npm test 292/292(portfolio 7, deploy-server portfolio 시나리오 추가), V2 3종목 진입·청산 100%·오류0, 격리 Chromium 210/210(1440/390/320×밝음/어두움, 종목 전환·요약·이스케이프·가로 넘침), 실제 공개 시세 로컬 3종목 실행 오류0(포트 8799, 임시 데이터).
- 알려진 한계: 킬 스위치가 다른 종목의 tick 진행 중에 겹치면 이론상 같은 포지션을 이중으로 매도할 수 있다(모의 코인은 0 아래로 내려가지 않게 막혀 있음). 실거래 전에 종목별 tick 직렬화가 필요하다.
- 배포 대기: 진행 중인 24시간 V3(~10-28 11:18 KST) 종료 후 서버 .env에 MARKETS=KRW-BTC,KRW-ETH,KRW-XRP, MAX_POSITION_KRW=2000000을 넣고 배포한 뒤 새 V3를 시작한다.

