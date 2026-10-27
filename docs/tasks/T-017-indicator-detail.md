# T-017 지표 세분화

## 수정하는 파일
- src/analysis/detail.js, src/strategies/index.js, web/decision.js
- test/indicator-detail.test.js, scripts/check-dashboard.mjs
- README.md, docs/tasks/T-017-indicator-detail.md
- docs/collab/BOARD.md, MESSAGES.md, VERIFY.md, docs/verify/*detail*.md, docs/verify/2026-10-26_KRW-*_240_defensive_btc.md, logs/T017-*

## 결정 사항
- 사용자 요청으로 모든 전략 공통 분석을 6분류 18항목으로 세분화. 추세/강도/모멘텀/거래량/변동성/가격 위치의 수치·상태·해석을 제공.
- 마감봉과 그 이전 자료만 사용. 분모0/결측/준비 부족은 자료 부족으로 표시. 20봉 상대 거래량 기준은 현재 봉을 제외.
- 기존 전략의 실제 필수 조건 및 점수와 상세 참고 관측을 구분. 참고 항목을 새로운 가중치로 중복 합산하지 않음. 기존 매수/매도 판단과 투자금 불변.
- 등록 전략 evaluate 공통 장식으로 동일 분석을 백테스트/Trader에 제공. 기존 analysis 필드 보존.

## 완료 기준
- 수식·미래불변·결측·모든 전략 판단 동일성·HTML 이스케이프 테스트.
- npm test, npm run verify, 화면 회귀 검증. 주문 규칙/실시간 연결은 변경하지 않음.

## 작업 로그
- 2026-10-26 시작. 운영 서버/설정 변경과 배포 없음.

- 공통 상세 분석 구현: 6분류18항목. 모든 등록 전략에 analysis.details 제공, 기존 analysis/매수/매도 조건 보존. 20봉 거래량·돌파 기준은 현재 봉 제외.
- 전용5개 테스트: CMF/거래량/고가 수식, 미래 봉 불변, 결측·분모0, 4개 전략 각90봉 판단 결과 동일성, 화면 이스케이프.
- V1: 전체205/205 통과(logs/T017-tests-unrestricted.log). 샌드박스 Windows 실행기2개 시간 초과 후 정상 권한 재검증 성공.
- V2: npm run verify -- 1500 KRW-BTC,KRW-ETH,KRW-XRP, defensive/수수료0.04%, 4/3/6건 진입·청산100% 일치/오류0(logs/T017-verify.log). 기존 규칙 그대로이며 수익성 개선 실험 아님.
- 브라우저192/192 통과: 1440/390/320px, 밝음/어두움, 6분류 펼침/18항목/가로 넘침 없음/오류0. logs/T017-browser.log, logs/dashboard-check/detail-*.png. 390px 밝음 이미지 직접 검토.
- git diff --check 통과. V3 추가 관측은 시세·주문 연결/판단 규칙 변경이 없어 미실시. 실제 연결 마감 처리는 T-016 기록 참조. 운영 미배포. Claude 리뷰 대기.
