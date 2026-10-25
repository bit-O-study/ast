# T-014 GitHub Actions 및 Windows 배포
담당: Codex · 사용자 명시 요청(2026-10-25)

## 결정 사항
사전 조회: AST private 저장소 workflows=0/runners=0, 서버 다른 프로젝트 러너 7개 운영 중. AST 전용 저장소 러너 bito-ast를 설치한다. PR 테스트는 GitHub Windows 호스트, main push/수동 실행은 테스트 통과 아티팩트를 전용 서버로 배포한다. 새 런타임 의존성 없음. MODE=paper, 기존 AST-Paper-Trader/localhost:8787 유지. 보유 포지션/실거래/오류 상태는 배포 거부. 신규 진입을 잠시 pause하고 무포지션 재확인 후 중지한다. 데이터/.env는 교체하지 않는다. 코드 교체 실패/건강 점검 실패는 기존 코드로 복구한다. 원래 일시정지 상태를 보존한다. CI 아티팩트 SHA/파일 해시와 경로를 검증한다. 배포용 신뢰 스크립트는 서버 별도 경로에 설치한다.

## 수정하는 파일
- .github/workflows/ast.yml
- scripts/deploy/package.mjs, scripts/deploy/deploy-paper.ps1, scripts/deploy/install-runner.ps1
- test/deploy.test.js, test/deploy-server.test.js
- docs/tasks/T-014-cicd.md, docs/setup/cicd.md
- docs/collab/BOARD.md, MESSAGES.md, VERIFY.md, docs/setup/server-ssh.md
- logs/ 검증 및 프로비저닝 임시 산출물(커밋 제외)

## 완료 기준
- 전체 npm test, 패키징 경로/해시 테스트 및 격리 PowerShell 배포 성공·거부·복구 테스트 통과.
- GitHub main 실제 CI 성공 및 전용 서버 CD 성공, 배포 SHA/HTTP/paper 상태 확인.
- 등록 토큰은 stdin/일시적 환경변수로만 전달, 저장/출력 금지.
- V3 관측 재시작 여부를 기록하고 새 봉 결과를 과거 결과로 대체하지 않는다.

## 작업 로그
- 2026-10-25: 기존 개발 main 737707a 푸시 완료. CI/CD 없음 확인 후 착수.

- 로컬 전체 npm test 173/173 통과. 신규 배포 검증 13개: 성공/기존 정지/보유/실거래/해시 변조/경로 이탈/추가 파일/건강 실패 복구/일시정지 중 포지션 생성/작업 불일치/종료 실패/패키지 격리. 초기 모의 함수 switch 인자와 PowerShell 동적 변수 범위 충돌을 수정 후 통과.
- AST 전용 runner 2.338.1 설치, 공식 SHA256 대조, GitHub runner id=2 online. 전용 서비스 Running 및 자동 시작. 다른 프로젝트 러너 수정 없음.

- 첫 GitHub 실행 40198452151: 테스트 170 통과/3 실패, 배포 skipped로 서버 무변경. GitHub Windows 임시 경로의 8.3 표기와 .NET 경로 정규화 차이를 확인해 배포 경로 비교를 정규화하고 짧은 경로 회귀 테스트를 추가했다.
- 서버 AST 작업의 기존 인자가 기본 경로에 의존하여 -ProjectRoot C:\ast를 명시하도록 Action만 갱신. PID 5852 유지. 설치기의 UpdateExisting은 트리거만 갱신하므로 Action은 검증 후 Set-ScheduledTask로 변경했다.

- 두 번째 GitHub CI는 경로 검증을 통과했지만 pwsh에서 Windows PowerShell을 실행할 때 상속된 PSModulePath 때문에 Get-FileHash 자동 로드에 실패했다. CI 기본 셸을 서버와 같은 Windows PowerShell로 지정하고 격리 테스트 자식 프로세스에서 PSModulePath를 초기화한다. 배포는 다시 skipped, 서버 중지 없음.

- 실행 40199582969에서 GitHub test 성공 및 패키지 업로드 성공. 배포 준비 단계는 서버 기본 PowerShell 실행 정책으로 차단됐다. 머신 정책 변경 없이 해당 단계만 ExecutionPolicy Bypass로 실행하도록 수정한다. 앱 중지/교체 단계는 실행되지 않았다.
