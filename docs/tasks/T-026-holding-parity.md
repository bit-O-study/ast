# T-026 보유기간 계산 일치 및 연구 재계산

## 수정하는 파일
- src/position.js, src/backtest.js, src/trader.js, test/holding-period.test.js, test/research-history.test.js
- scripts/observe-research-history.mjs, scripts/audit-research-parity.mjs
- docs/tasks/T-026-holding-parity.md, docs/tasks/T-025-rolling-forecast.md
- docs/collab/BOARD.md, docs/collab/MESSAGES.md, docs/collab/VERIFY.md
- docs/verify/2026-10-26_*methods*.md, docs/verify/2026-10-26_*exits*.md, docs/verify/2026-10-26_*entry-filters*.md, docs/verify/2026-10-26_*persistent*.md, docs/verify/2026-10-26_*entry-quality*.md, docs/verify/2026-10-26_*long-trend*.md, docs/verify/2026-10-26_*timeframes*.md, docs/verify/2026-10-26_*rolling-forecast*.md
- docs/verify/2026-10-26_KRW-*_240_score_btc.md, docs/verify/2026-10-27_KRW-*_240_score_btc.md, docs/verify/2026-10-27_execution-parity.md
- logs/T018-*, logs/T019-*, logs/T020-*, logs/T021-*, logs/T022-*, logs/T023-*, logs/T024-*, logs/T025-*, logs/T026-*

## 결정 사항
- T025 BTC1일 후보에서 리플레이4거래/백테스트3거래, 진입75%/청산66.7%.2026-08-21 KST 진입 건은 리플레이8/27 보유기간 청산, 백테스트8/28 목표가 청산. 성과 미충족과 별도로 실행 정확성 미충족으로 처리한다.
- 원인: Trader는 진입 직전 신호봉 시각(entryCandleT)부터 경과 봉 수를 계산하나 백테스트는 진입 봉 인덱스부터0으로 세어 첫 보유봉 마감이0봉이었다. 실제 경로의 첫 보유봉 마감=1봉으로 통일한다. 누락봉도 두 경로에서 같은 시각 차이로 계산한다.
- 공통 completedHoldingBars(entrySignalAt,signalAt,unitMinutes)를 position 모듈에 두고 양쪽에서 호출. Trader 상태 형식/계산 의미/운영 설정은 유지한다. 백테스트만 실제와 맞춘다. 수익률에 맞춘 규칙 변경 아님.
- 수정 전 합성 리플레이 회귀 테스트로 불일치 재현. 수정 전 연구 결과/보고서/로그를 logs/T026-before-parity/에 보존한 뒤 고정시세 T018~025 재계산. 후보/비용/임계치/승격 기준 변경 없음. 기존 결과를 개선 근거로 사용하지 않는다.
- 기존 공백 포함 최근 기본3시장 V2, 전체 테스트, T025 불일치 후보 재검증 필수. Trader 수학식만 공통 함수로 이동해 의미 불변, 실제 연결/주문 실행 변경 및 운영 배포 없음.
- T015~017의 과거 수익성 수치는 이번 수정 전 결과이며 최신 성과 근거로 사용하지 않는다고 감사 보고서에 명시한다. 기존 자료 자체를 삭제하지 않는다.
- 2026-10-27 추가 실행 경로 감사: 실제 candles200 응답에는 진행 봉이 포함되어 마감199개일 수 있지만 리플레이는 마감200개를 제공한다.200봉을 요구하는 T025 모델이 실제 연결에서 준비되지 않는 문제를 발견했다. 전략 minBars를 충족하도록 필요한 경우에만 candlesRange로201개 조회하고 마감200개로 제한한다. 기존 minBars<200 전략 조회 횟수는 유지. 부족 데이터는 명시 오류. 현재 봉 포함 가짜 응답으로 수정 전 재현 후 실제4시간 준비/1분봉 마감 V3로 확인한다.

## 완료 기준
- 수정 전 합성2건 실패 재현, 정상/공백 시각 보유기간 및 공통 리플레이 일치.
- npm test, npm run verify -- 1500 KRW-BTC,KRW-ETH,KRW-XRP.
- T018~025 고정 후보 재계산·전후 비교/실행 불일치 공개. 통과 못한 후보를 승격하지 않는다.

## 작업 로그
- 2026-10-26 T025 검증 중 발견, 성과 최적화 중단하고 실행 경로 일치 작업 착수.
- 2026-10-27 수정 전 합성 보유기간2건과 현재 봉 포함 준비봉1건 실패 재현. 공통 경과봉 계산 및 minBars 확보 수정 후 전용4/4, 최종 전체242/242 통과(logs/T026-tests-final.log).
- 기본 V2 최신1500봉 BTC17/ETH16/XRP19거래 진입·청산100%/오류0(logs/T026-verify.log,2026-10-27 보고서). 최초 네트워크 EACCES는 정상 권한 재검증으로 해결.
- 수정 전130개 결과·보고서·로그를 logs/T026-before-parity/에 보존. 고정 원본3종목 SHA256 불변 확인. T018~025의756개 비교 행 중251개 수치 변경,27후보 모두 엄격 기준 미달.81개 리플레이 진입·청산100%/오류0, 그중 XRP7일 모델1개는0거래이므로 거래 실행 검증에서 제외. 소스/조건 변경으로 결과를 숨기거나 통과시키지 않음.
- V3: 격리 paper 실제4시간200마감봉/3모델 계산 가능,1분봉200마감봉 유지·마감시각 전진·오류0·거래0(logs/T026-paper-observation.json).4시간 장기 운용/수익성 검증은 아님. 운영 설정·배포 변경 없음.
- 감사 스크립트 scripts/audit-research-parity.mjs 및 보고서 docs/verify/2026-10-27_execution-parity.md 생성. 기존 연구 보고서에 재계산 표시를 추가하고 이전 수치 사용 범위를 명시. 리뷰 대기.
