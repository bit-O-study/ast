# T-016 방어형 진입 판단 구체화

## 수정하는 파일
- src/strategies/defensive.js, src/strategies/index.js, src/strategy.js
- web/decision.js, web/app.js, test/defensive.test.js
- scripts/research-defensive.mjs, scripts/observe-defensive.mjs
- README.md, .env.example
- docs/tasks/T-016-defensive-entry.md, docs/collab/BOARD.md, MESSAGES.md, VERIFY.md
- docs/verify/*defensive*.md, logs/T016-*

## 결정 사항
- 사용자 후속 고도화 요청으로 진행. Claude 리뷰 예정, 운영 배포 없음.
- 기존 score와 같은 투자금/위험/청산을 사용하는 선택형 STRATEGY=defensive. structure 분할 기능 유지.
- 결과 확인 전에 고정한 기준: 점수 2봉 연속 충족, 종가>20MA>60MA 및 20MA 3봉 상승, ADX>=25 및 +DI>-DI, RSI 50~70 및 20MA 대비 2ATR 이내. 결측 자료 차단.
- 주문 직전 상승 갭 0.5ATR 초과/20MA 이탈 차단, 가까운 60봉 저항도 검사. 수수료·매도 슬리피지 포함 1차 순손익비>=MIN_RR. 공유 planEntry 사용.
- 임계치 탐색 없음. 기존 캐시1499봉 전체/후반30%, 수수료0.04%/0.25%, 동일 규모 비교. 이미 관찰한 구간으로 독립 검증 아님.
- 각 필수 조건 실제 수치/기준/관망 이유 표시. 점수는 확률 아님.

## 완료 기준
- 결측/과열/약세/미래 참조/비용/갭/저항/정상 진입 테스트.
- npm test 및 npm run verify BTC/ETH/XRP, 격리 모의 V3 최소 마감봉1회.
- 손익·손실률·낙폭·거래당 수익률·거절 이유 공개. 개선 미확인 시 운영 기본값 승격 안 함.

## 작업 로그
- 2026-10-26: 결과 조회 전 기준 고정. 최초 문서 기록의 PowerShell 인코딩 손상 복구.

- 구현: defensive 필수 조건 4종/수치·사유 표시, 공통 planEntry 갭·20이평·근접 저항·비용 포함 손익비 검사. 기존 score/structure 선택 경로 유지.
- V1: 전체200/200 통과(logs/T016-tests-unrestricted.log). 최초 샌드박스 실행은 Windows 실행기 테스트2개 시간 초과, 정상 권한 재실행 성공. 전용5개는 결측·약세·과열·미래불변·주문 비용·HTML 검증.
- V2: npm run verify -- 1500 KRW-BTC,KRW-ETH,KRW-XRP, defensive/편도0.04%. 거래4/3/6건, 진입·청산100% 일치, 오류0. logs/T016-verify.log 및 docs/verify/2026-10-26_KRW-*_240_defensive_btc.md.
- V3 제한 확인: 별도 모의 저장소 logs/T016-paper-yVzypo, 1분봉 마감 시각1792987140000→1792987200000, 판단 갱신/오류0. 4시간봉 장기 운용이나 수익성 검증이 아님. logs/T016-paper-observation.json.
- 고정 조건 비교(0.04%, 전체): BTC 손실률53.3→25.0%(15→4건), ETH62.5→33.3%(16→3건), XRP80→100%(20→6건). 순손익 BTC72,486→51,954원, ETH-49,910→67,140원, XRP-15,389→-99,721원. 후반 구간 및 비용0.25%도 보고서 공개. XRP 악화/표본 부족으로 운영 기본값 승격 안 함. 거래 수 감소에 따른 노출 축소 효과가 포함됨.
- 소스 참고: https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/DMI (ADX 강도와 DI 방향 구분). 이 임계치의 우수성을 출처가 입증하는 것은 아님.
- 계정 수수료 미조회, 0.04%는 가정. .env/운영 서버/실주문 변경 없음. Claude 리뷰 대기.

- 기존 대시보드 브라우저 회귀186/186 통과(logs/T016-browser.log). 새 방어형 표시 자체는 전용 HTML/이스케이프 단위 테스트로 검증. git diff --check 통과. 보드 리뷰 대기로 전환.
