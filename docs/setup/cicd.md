# AST CI/CD 운영

## 구성
- GitHub Actions: `.github/workflows/ast.yml`, PR/main/수동 실행.
- GitHub Windows 호스트: Node 24, `npm ci --ignore-scripts`, `npm test`.
- main 성공 시: 테스트한 src/web/node_modules/package 파일만 release.json 해시 목록과 함께 아티팩트로 전달.
- 전용 저장소 러너: bito-server-ast, 라벨 bito-ast, Windows 서비스 자동 시작.
- 서버 신뢰 배포기: `C:\services\Bit-O\ast\tools\deploy-paper.ps1`.
- 앱 경로: `C:\ast`, 기존 `AST-Paper-Trader` 작업, localhost:8787 모의투자 유지.
- CI/CD는 main 전용, PR 코드는 GitHub 호스트에서만 테스트한다. 저장소는 private이며 전용 러너는 기존 AST 작업과 같은 SYSTEM 계정으로 동작한다. 폴더 ACL은 SYSTEM/Administrators로 제한한다.

## 배포 동작
1. 최신 main SHA 확인, 테스트 성공 아티팩트 다운로드.
2. SHA/모든 파일 해시/허용 경로/필수 파일/링크 유무 및 AST 작업 설정 검사.
3. 정상 paper/무포지션/코인 0 확인. 신규 진입을 일시정지한 후 다시 확인.
4. 봉 관측 기록 보존 후 관측 중지. AST만 Disable→Stop 및 포트 종료 확인.
5. src/web/node_modules/package 파일 교체. .env/data/logs 및 서버 관리 스크립트는 유지.
6. Enable→Start, HTTP/잔고/무포지션/일시정지 상태 검사.
7. 정상 시 원래 실행 상태로 복원하고 logs/deploy 아래 SHA·시각 기록. 실패 시 이전 코드로 복구 후 재검사한다.
8. 봉 관측은 새 프로세스로 다시 시작한다. 관측 완료 전 V3 통과로 보지 않는다.

동시 배포는 workflow concurrency 및 서버 mutex로 막는다. 보유 포지션/실거래/킬 스위치/현재 오류가 있으면 자동으로 청산하거나 중지하지 않고 해당 배포를 실패 처리한다. 포지션 정리 이후 Actions에서 최신 main을 수동 실행한다. 사용자 일시정지는 배포 후에도 유지한다. 운영 데이터는 롤백하지 않는다.

## 확인 및 재실행
GitHub 저장소 Actions → AST CI and paper deployment → 실행 결과의 test/deploy 둘 다 success인지 확인한다. 실패한 테스트는 서버 배포를 실행하지 않는다. 보유 중 거부는 무포지션 이후 Run workflow(main)로 재실행한다.

서버 `C:\ast\release.json`의 sha가 배포 커밋이다. `node scripts/server/check-paper.mjs --json`으로 paper 상태와 봉 관측을 확인한다. 복구 및 이전 코드 기록은 `C:\ast\logs\deploy\<sha>-<id>`에 보존된다. 배포 스크립트 자체는 자동 교체하지 않으므로 수정 시 테스트 후 Tailscale로 신뢰 경로에 별도 반영한다.

## 한계
서버 전원/OS 자체의 장애나 배포 도중 강제 종료는 이 스크립트의 자동 복구 범위를 벗어난다. 데이터베이스 스키마 변경이나 실거래 배포는 현재 자동화 대상이 아니다. 현재 런타임은 외부 ws 패키지 외 별도 빌드가 없다.

## 근거
- [GitHub self-hosted runner 설치](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)
- [GitHub 아티팩트 조회](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)
