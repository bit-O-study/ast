# T-009B 전략 기록 및 월별 성과

담당: Codex · 사용자 위임(2026-10-25) · 리뷰 대기 (V3 관측 중)

## 결정 사항
사용자가 전략 기록 저장 서버 코드와 성과 화면 구현을 이어 진행하도록 위임했다. 매매 판단/주문/손익 계산은 변경하지 않는다. 진입 시 strategy: {id, name} 사본을 저장하고 청산에 전달한다. ID가 없으면 null, 이름이 없으면 ID를 표시한다. 기존 기록은 추정하지 않는다. 월별 집계는 저장된 ID별로 합산하며 이름은 해당 월 최신 거래의 기록을 사용한다. CSV 끝에 전략 ID와 이름을 추가한다.

## 수정하는 파일
- src/position.js, src/trader.js, src/backtest.js
- test/position.test.js, test/trader.test.js, test/backtest.test.js, test/performance.test.js
- web/performance.js, web/app.js, web/index.html, web/style.css
- scripts/check-dashboard.mjs
- 이 명세, docs/collab/BOARD.md, MESSAGES.md, VERIFY.md, docs/setup/server-ssh.md
- docs/verify/ 자동 생성 보고서, logs/ 검증 산출물

## 완료 기준
- 진입 전략 사본/부분 청산/저장 재로딩/설정 변경/기존 기록 호환 테스트 통과.
- 전략별 건수·성공·실패·순손익 합계가 선택 월 달력과 일치. 빈 월·미상 전략·HTML/CSV 안전 처리.
- npm test 전체, 화면 3개 폭×2개 테마, V2 실제 BTC/ETH/XRP 리플레이 통과.
- Tailscale 서버 반영 및 paper 운영 확인. V3는 배포 후 다음 봉 마감 포함 관측을 별도 기록하며 완료 전 통과로 표기하지 않는다.

## 작업 로그
- 2026-10-25: 사용자 위임에 따라 시작. 외부 의존성 추가 없음.

- 진입/청산 strategy 사본 저장, Trader·backtest 전달 구현. 저장 재로딩 후 다른 전략으로 실행하더라도 최초 전략 유지, legacy null 확인.
- 월별 전략 ID 집계 및 CSV 전략 ID/이름 열 구현. 미상 기록 별도 표시, HTML 이름 이스케이프/CSV 수식 중립화 유지.
- V1: 전용 37/37, 로컬 전체 160/160, 서버 전체 160/160 통과. 브라우저 1440/390/320px×밝음/어두움 156/156 통과. 모바일 캡처 검토 및 git diff --check 통과.
- V2: 실제 1,500봉 BTC 17건/ETH 16건/XRP 20건, 진입·청산 경로 모두 100% 일치/오류 0. docs/verify/2026-10-25_KRW-*_240_score_btc.md.
- 브라우저 첫 실행은 음수 기대값이 ASCII 하이픈인 테스트 오류 6개. 기존 화면의 유니코드 음수 부호에 맞춰 수정 후 통과(제품 코드 변경 불필요).
- 서버 기존 코어 3개가 HEAD LF 해시와 일치함을 확인. logs/T009B-before에 소스 백업, 준비 폴더 전송 및 해시 확인 후 paper/무포지션을 재확인했다.
- AST만 Disable→Stop→포트 종료 확인→반영→Enable→Start. PID 4680→5852. 코드 6개 해시 일치, 전략 표/모듈 HTTP 제공 확인. 서버 테스트 파일도 반영했다. 백업/준비 테스트는 .bak 확장자로 보존해 npm test 자동 탐색 중복을 방지했다.
- UTC ms 1792933558041: paper, 1,000만 원, coin=0, position 없음, 오류·경고 0.
- V3 신규 관측 시작: AST-Paper-Observation, logs/paper-observation.json state=running/samples=1. 다음 마감 목표 1792940403000 UTC ms(2026-10-26 00:00:03 KST). 기존 passed 결과는 logs/T009B-before/paper-observation.json에 보존. 새 관측은 아직 통과 아님; 이후 결과 확인 필요.
- 실제 새 진입/청산이 서버에서 발생한 것은 아직 확인하지 않았다. 기능은 가짜 시세 paper 테스트와 V2로 검증했다. 실거래 전환·키 변경 없음.

- 2026-10-25 main 반영: 사용자 후속 지시에 따라 누적 Codex 구현·테스트·운영 문서를 커밋 대상으로 정리했다. 원격 main 기준 13435c9 일치 확인. 기존 AGENTS.md 변경 및 logs 산출물은 포함하지 않는다. 최신 코드 검증은 로컬/서버 160개, 브라우저 156개, V2 세 시장 통과 기록을 사용한다. 서버 예약 작업은 자동 실행·복구이며 Git push 연동 CI/CD는 아직 없음.
