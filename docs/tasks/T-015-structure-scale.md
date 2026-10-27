# T-015 구조·수급 판단과 2단계 분할매매

- 담당: Codex. 사용자 2026-10-26 명시적 고도화 요청으로 설계·구현. Claude 리뷰 대기 예정.
- 기존 운영 설정 변경/배포는 포함하지 않는다. 기존 score/breakout 비교 경로를 보존한다.

## 수정하는 파일

- src/analysis/structure.js, src/strategies/structure.js, src/strategies/index.js
- src/scale.js, src/config.js, src/position.js, src/trader.js, src/backtest.js, src/sim/replay.js
- web/app.js, web/decision.js, scripts/check-dashboard.mjs (새 정적 모듈 테스트 경로), .env.example, README.md
- test/structure.test.js, test/scale.test.js, test/scale-trader.test.js, test/decision.test.js
- scripts/research-structure.mjs, scripts/observe-structure.mjs
- docs/verify/*structure*.md, docs/verify/2026-10-26_*score*.md
- 이 명세 및 docs/collab/BOARD.md, MESSAGES.md, VERIFY.md

## 결정 사항

- STRATEGY=structure는 실험용 구조 전략. 추세/모멘텀/수급/가격 구조를 별도 평가하고 필수 조건을 모두 확인한다. 합계는 확률이 아니다.
- 마감봉만 사용. 좌우 2봉으로 확인된 피벗만 사용하며 확인 시각을 보존한다. 미래 피벗으로 과거 신호를 바꾸지 않는다. 1차 상승·눌림·재상승의 관측이며 엘리엇 전체 5파 판정이 아니다.
- 와이코프의 spring/SOS/LPS를 참고한 가격·거래량 대용 지표. 실제 큰손 매집/자금 유입으로 단정하지 않는다.
- John Bollinger의 중복 지표 경계, 와이코프의 돌파·저거래량 지지 확인, Turtle의 유리한 방향 추가 진입을 참고한 자체 규칙이다. 원전 전략의 복제나 성과 재현을 주장하지 않는다.
- SCALE_IN=true: 총 계획 예산의 40% 1차, 잔여 예산 이내 2차. structure에서는 기본 활성화, 기존 전략 기본 비활성화. 모의 모드에서 먼저 제공한다.
- 2차는 최초 매수가보다 0.5 ATR 이상 높고 비용 반영 이익 상태, 새 마감봉의 구조·추세·수급 확인, 1차 익절 전, 순손익비·총 원금·예상 손절 손실 한도 충족 시에만 허용. 하락 중 기계적 물타기는 하지 않는다.
- 예산·위험 한도는 1차 진입 때 고정한다. 추가 매수 때 평균단가·총수량·총비용 갱신, 손절/목표는 불리하게 이동하지 않는다. 목표는 최초 계획 고정, 추가 매수 후에도 순손익비 검사.
- 기존 1차 목표 일부 매도→2차 잔여 매도·추적 손절을 재사용. 분할 포지션의 본전은 실제 매수비용·수수료·슬리피지로 계산한다.
- 포지션 entries/scale/analysis는 선택 필드. 기존 저장 데이터는 추가 매수하지 않고 정상 청산한다. buy 이벤트에는 stage 추가(동일 positionId의 최대 2회 buy). 계약 원본은 수정하지 않고 MESSAGES에 제안한다.
- 일시정지/일일 한도/킬 스위치/하락 국면/구조 무효/청산 우선 조건은 추가 매수에도 적용한다. 재시작에도 단계·마지막 판단봉을 보존한다.

## 완료 기준

- 미래 참조/피벗 확인 지연, 결측·평탄 시세, 조건 미충족 설명 테스트.
- 1·2차 예산/비용 포함 위험, 중복 추가 매수 방지, 부분 매도 후 추가 금지, 재시작·기존 포지션 호환, 2단계 매도와 손익 보존 테스트.
- npm test 전체, npm run verify BTC/ETH/XRP 기존 및 새 전략. V2는 매수 단계 일치도도 확인한다.
- 화면에 판단 근거/파동 관측·추정 수급/단계·평균단가 표시. 기존 UI 수정 보존.
- V3는 격리 모의 실행에서 마감봉 처리 검증. 실제 시세 장기 관측·수익성 검증 여부를 별도 기록하고 미실시를 통과로 쓰지 않는다.

## 출처

- https://www.bollingerbands.com/bollinger-band-rules : 상관된 지표를 중복 확인으로 취급하지 않으며 밴드 접촉만으로 매매하지 않음.
- https://www.wyckoffanalytics.com/wyckoff-method/ : spring/test, SOS, LPS의 가격·거래량 맥락.
- https://www.turtletrader.com/rules/ : 변동성에 따른 위험과 추세 추종 체계. 수익 중 추가 진입은 교육적 참고이며 본 구현의 40/60 비율은 자체 설계.
- https://www.elliottwave.com/wave-riffs/questions-we-get-questions/ : 파동 규칙을 단순 예측 확정으로 해석하지 않음.

## 작업 로그

- 구조 전략과 공통 분할 예산/체결 모듈 구현. 기존 전략 기본값 유지. 추가 런타임 의존성 없음. 1차/2차 매수와 기존 1차/2차 매도 연결, 평균단가·누적비용·단계·판단 근거 저장.
- 리플레이 대조에 분할 매수 단계 및 신호봉 일치율 추가. 기존 백테스트 데이터 로더가 미완성 봉도 포함하던 것을 발견해 대상/BTC 모두 마감봉만 유지하도록 보완.
- V2: 기본 수수료 0.25%에서 score BTC/ETH/XRP 17/16/20건, structure 1/2/1건. 0.04%에서 score 15/16/20건, structure 4/2/2건. 12개 경우 모두 진입·청산 경로·분할 단계 100% 일치, 오류 0. 실제 추가 매수는 0.04% BTC 2건이며 별도 합성 시나리오에서도 2차 진입 및 청산을 강제 실행해 검증했다.
- 탐색 결과: 0.04% structure 분할 BTC -31,053원/ETH -11,194원/XRP +40,399원. 거래 4/2/2건. 기존 score 대비 일관된 우위가 없으므로 운영 기본값으로 채택하지 않는다. 후반 구간도 보고서에 그대로 공개했다. 작은 투자 노출 때문에 손실이 작아진 것을 신호 개선으로 해석하지 않는다.
- 브라우저 186/186 통과: 1440/390/320px × 밝음/어두움, 기존 성과 기능과 새 파동·수급·평균단가·분할 단계 확인. structure-390-light.png 직접 시각 확인. 기록: logs/T015-browser.log, logs/dashboard-check/result.json.
- V3 제한적 실제 시세 확인: 운영과 다른 logs/T015-paper-yK78u6 저장소, MODE=paper/1분봉/BTC 국면 필터 off. UTC 1792985097080~1792985107605, 판단봉 1792984980000→1792985040000, 오류 0. 구조 판단 갱신 확인. 이때 매매 신호는 없었으므로 실제 시세에서 분할 체결이나 4시간봉 장기 운용을 확인한 것은 아니다. 기록: logs/T015-paper-observation.json.
- 검증 중 Windows 실행기 2개가 샌드박스 권한 제한으로 실패. 승인된 동일 테스트 재실행 194/194 통과. 이후 데이터 부족 시 ADX/RSI의 NaN→JSON null→화면 오류 가능성을 보완하고 미완성 봉 제외 회귀 테스트를 추가해 최종 전체 195/195 통과(실패·건너뜀 0). logs/T015-tests-unrestricted.log. git diff --check 통과. Claude 리뷰 대기.
- 운영 서버/설정/키/실주문 변경 및 배포 없음. 수익성은 미검증이며 전략은 선택형 모의 실험으로 제공.

- 수수료 후속 조사: https://feed.bithumb.com/notice/1654522 (2026-09-07 갱신)는 API 무료 이벤트 9월 6일 종료·이후 기존 수수료 적용 명시. 8월 27일 소개 공지의 무료 문구보다 구체적인 종료 공지를 우선한다. 0.04%는 0.0004이며 계정 적용은 /v1/orders/chance의 bid_fee/ask_fee로 확인해야 한다. 키를 읽지 않았고 계정 요율을 확인한 것은 아니다. 운영 수수료를 바꾸지 않고 0.04%/0.25% 비교 검증한다.

- 2026-10-26: 기존 코드/협업 규칙 검토, 공개 원전 조사 및 구현 명세 기록. 신규 전략은 성과 미검증 상태로 시작.
