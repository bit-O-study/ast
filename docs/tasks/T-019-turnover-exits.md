# T-019 재진입·청산 연구

## 수정하는 파일
- src/reentry.js, src/config.js, src/trader.js, src/backtest.js
- src/research/exit-profiles.js, scripts/research-exits.mjs, scripts/observe-turnover.mjs
- test/reentry.test.js, test/reentry-trader.test.js
- .env.example, README.md
- docs/tasks/T-019-turnover-exits.md, docs/collab/BOARD.md, MESSAGES.md, VERIFY.md
- docs/verify/*exits*.md, docs/verify/2026-10-26_KRW-*_240_score_btc.md, logs/T019-*

## 결정 사항 (성과 조회 전 고정)
- 사용자 될 때까지 연구 요청. T018 전체 데이터 재사용은 탐색이며 독립 검증으로 주장하지 않음. 추후 통과 후보에 한해 아직 성과를 확인하지 않은2024년 이전 시세에서 확장 확인.
- 진입 score 고정, 기본 위험/투자금/초기손절 유지. 프로필5개: baseline, cooldown(손실 청산 후6봉 재진입 대기), patient(MAX_HOLD_BARS120), runner(1차25%/2차8R/보유120), combined(runner+cooldown6). 총4새 후보. 수수료/슬리피지/3종목/3연속구간은 T018 동일.
- 현 코드의 MAX_HOLD_BARS는 강제 청산이 아니라 손절가를 종가-0.5ATR로 좁히는 시점. 기간 확장은 초기 위험 한도를 확대하지 않음. 손절가는 내려가지 않음.
- LOSS_COOLDOWN_BARS 기본0, 정수0~240. 실험은 paper 전용. 손실은 비용 포함 청산손익<=0. 마지막 손실 청산 시점의 최신 마감 신호봉을 상태에 저장, 이후6번째 신호봉부터 재진입 허용. 청산 중/추가매수에 영향 없음. 재시작 유지. 백테스트/Trader 같은 허용 함수 사용.
- 필요조건 T018 동일: 중기/최근 각각3계좌 평균수익률>score baseline, 각기간 최소2종목 양수, 후반30거래 이상, 평균MDD<=baseline1.2배, 비용 스트레스 평균양수. 사후 종목 제외나 임계치 재조정 없음.
- 모두 통과한 후보만 미관찰 과거 구간 확인. 미래 수익 보장/실서버 자동 배포 없음.

## 출처
- https://www.man.com/insights/need-for-speed-trend-following : 빠른 전략의 높은 회전율과 비용. cooldown6 자체의 수익성 근거는 아님.
- https://www.turtletrader.com/rules/ : 진입뿐 아니라 청산/위험을 포함한 체계 필요. 본 분할매도와 보유 규칙은 자체 가설.

## 완료 기준
- 재진입 경계/기본값 불변/손익기준/재시작/백테스트·모의 일치 테스트, npm test, npm run verify 및 별도1분봉 마감 V3.
- 모든 프로필 결과·탈락 이유 공개. 성공 여부와 구현 검증 구분.

## 작업 로그
- 2026-10-26 연구 시작. 운영 설정/실주문 변경 없음.
- 2026-10-26 후속 확인: 5프로필×3종목×3구간×2비용=90개 비교. 후보4개 모두 최근 비용 스트레스 평균 비양수로 탈락. 후보12개 모의 리플레이 진입/청산100% 일치·오류0, 기본 V2 3종목15/16/20거래 일치. 기존 결과 파일 확인 완료.
- V1 샌드박스 실행기2개 제한 시간 초과 후 정상 권한 전체216/216 통과(logs/T019-tests-unrestricted.log). 공개 시세 접근 실패 후 정상 권한 격리 paper 1분봉 마감 전진·오류0 확인(logs/T019-paper-observation.json). 이는 단기 연결 검증이며 수익성 검증이 아님. 승격 후보 없음, 리뷰 대기.
