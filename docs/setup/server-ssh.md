# 운영 서버 접속 (SSH)

자동매매를 상시 실행할 집 안 Windows 서버에 접속하는 방법입니다. Claude와 Codex 모두 이 문서를 따릅니다.

## 서버 정보

| 항목 | 값 |
|---|---|
| 위치 | 집 안 네트워크 (같은 공유기) |
| 운영체제 | Windows 11 Home (10.0.26100) |
| LAN IP | `192.168.219.183` (사용자 제공) |
| 계정 | `desktop-firut4i\pc` (SSH 로그인 확인) |
| 접속 방식 | SSH 키 인증 (비밀번호 사용 안 함) |
| 프로젝트 경로 | `C:\ast` |

IP와 계정이 확인되면 이 표를 채웁니다.

## 접속 방법

이 PC(개발 PC)에서, 같은 Windows 계정으로 실행 중인 에이전트라면 아래 명령으로 바로 접속됩니다.

```bash
ssh <계정>@<서버IP>            # 접속
ssh <계정>@<서버IP> hostname   # 접속 확인용 한 줄 실행
```

- 사용하는 키: 개발 PC의 `~/.ssh/id_ed25519` (공개키 주석 `ast-claude`)
- 서버에 등록된 위치: `C:\ProgramData\ssh\administrators_authorized_keys`
- 서버 쪽 셸은 PowerShell 또는 cmd입니다. 원격 명령은 Windows 문법으로 쓰세요. 예: `ssh <계정>@<서버IP> "powershell -Command Get-Service sshd"`
- 웹(클라우드)에서 실행되는 에이전트는 접속할 수 없습니다. 서버가 집 안 네트워크에서만 접속되게 막혀 있기 때문이며, 그대로 유지합니다.

## 규칙

1. **비밀키(`~/.ssh/id_ed25519`, `.pub` 없는 파일)는 절대 출력·복사·커밋하지 않습니다.** 공개키(`.pub`)만 서버에 등록합니다.
2. **방화벽을 바꾸지 않습니다.** SSH는 `LocalSubnet`(집 안)만 허용되어 있습니다. 공유기 포트포워딩도 하지 않습니다.
3. **서버 작업은 보드에 먼저 표시합니다.** 코드 작업처럼 `docs/collab/BOARD.md`에 `개발 중 · Claude` 또는 `개발 중 · Codex`로 표시한 쪽만 서버를 수정합니다. 두 에이전트가 동시에 서버를 바꾸지 않습니다. 단순 조회(상태 확인, 로그 보기)는 표시 없이 해도 됩니다.
4. **서버에서 한 변경은 기록합니다.** 아래 "변경 기록" 표에 날짜, 누가, 무엇을 남깁니다.
5. **실거래 전환(`MODE=live`)과 API 키 입력은 사용자만 합니다.** 에이전트는 `.env`의 키 값을 읽거나 출력하지 않습니다.
6. 서버를 재부팅하거나 자동매매 프로세스를 멈추기 전에는 `MESSAGES.md`에 이유를 남기고, 보유 포지션이 있으면 사용자에게 먼저 확인받습니다.

## 서버 준비 상태

| 단계 | 상태 |
|---|---|
| OpenSSH 서버 설치 (`Add-WindowsCapability ... OpenSSH.Server`) | 완료: SSH 키 인증 접속 확인 |
| sshd 시작·자동 시작 | 확인: 실행 중, 자동 시작 |
| 방화벽 집 안 네트워크만 허용 | 확인: RemoteAddress=LocalSubnet |
| 공개키 등록 (`ast-claude`) | 완료: 공개키 개행 수정 후 인증 성공 |
| 개발 PC에서 접속 확인 | 완료: pc 계정으로 whoami 성공 |

## 접속 후 할 일 (PLAN.md §8)

- 절전·최대 절전 끄기, Windows 업데이트 사용 시간 설정
- Node.js 20 LTS, Git 설치 → `git clone https://github.com/bit-O-study/ast.git C:\ast`
- 시간 자동 동기화 확인
- 부팅 시 자동 시작 + 비정상 종료 시 재시작 (T-010)
- 공인 IP 확인 → 사용자가 빗썸 API 허용 IP에 등록
- 모의투자(`MODE=paper`)로 실행

## 변경 기록

2026-10-26: Codex가 기존 main CI/CD 경로로 성과 UI 후속을 배포했다. Actions 40256242473 test/deploy success, 서버 release SHA 6632c122f39d7eba4089a43ea072f642d419eef4 일치. 배포 전후 paper/무포지션 확인. UTC 1792980503084 점검에서 오류·경고 0, 새 봉 관측 running/32회(12:00:03 KST 마감 목표). 부모가 만든 개발 PC SSH 터널 PID3276/localhost8788은 유지했다. 실거래/API 키/방화벽 변경 없음.

| 날짜 | 누가 | 변경 |
|---|---|---|
| 2026-10-23 | 사용자 | 개발 PC에서 SSH 키(`ast-claude`) 생성, 서버에 OpenSSH 설치 시작 |
| 2026-10-23 | Codex | SSH 포트 연결 및 호스트 키 등록 확인. pc 및 사용자 제공 컴퓨터명 포함 계정 모두 공개키 인증 거부. 로컬 ast-claude 키를 제공했으나 서버가 수락하지 않음. 서버 설정 변경은 아직 없음. |

## 다른 프로젝트용 접속 안내

[공용 Windows 서버 SSH 안내](windows-server-ssh.md)를 다른 프로젝트에 복사하거나 Codex에게 읽도록 지시하세요. 개인키 내용은 포함하지 않았습니다.

## 서버 준비 진행 기록

- Codex: 공개키 인증 성공. 서버는 Windows 11 Home, 실제 계정 desktop-firut4i\pc.
- Node.js v24.22.1 및 Git 2.55.0.windows.5 설치 성공.
- AC 절전 해제, 최대 절전 해제. Windows Time 서비스 자동 시작 및 실행 설정.
- 최초 시간 재동기화는 시간 데이터를 받지 못해 실패. 동기화 성공 여부는 추가 확인 대상.
- 서버 GitHub 인증이 없어 clone 실패. 자격증명을 복사하지 않고 src/web/test 및 package.json/package-lock.json을 압축 전송.
- 재사용 접속 문서는 docs/setup/windows-server-ssh.md. 서버 변경 완료 여부와 접속 방법 문서를 구분함.
## 2026-10-25 서버 준비 작업 로그 (Codex)

- 수정 범위: scripts/server/run-paper.ps1, scripts/server/install-paper-task.ps1, 서버 package.json(로컬 검증본 반영), 이 문서와 협업 기록.
- 결정 사항: 기존 모의투자 전용 스크립트를 설치한다. 매매 핵심 및 T-008 연결은 변경하지 않으며 T-010 전체 완료로 처리하지 않는다.
- 시간 동기화 확인: Windows Time의 source=time.cloudflare.com, stratum=4, Leap Indicator=0. 마지막 성공 시각은 서버 출력 기준 2026-10-24 16:55:12.
- C:\ast\scripts\server에 준비된 스크립트 2개 전송 후 AST-Paper-Trader 예약 작업 설치 및 기동.
- 예약 설정 조회 확인: SYSTEM, 부팅 시 실행, 실패 시 1분 간격 최대 999회 재시작, 실행 시간 제한 없음. 실제 재부팅·강제 종료 복구 시험은 미실시.
- 서버의 이전 npm test(node --test test/)가 Node.js 24에서 MODULE_NOT_FOUND로 실패했다. 이미 로컬에서 검증된 package.json(node --test)을 반영한 뒤 서버 npm test 109/109 통과.
- 로컬 npm test도 109/109 통과. 매매 핵심 코드 변경이 없어 V2 재실행 대상 아님.
- /api/status: mode=paper, KRW-BTC 240분봉, 현재가 108,618,000원, 모의자금 10,000,000원, position=null, lastError=null. 시작 이벤트 확인.
- 대시보드는 127.0.0.1:8787에서만 수신. 방화벽 변경, 키 입력, 실거래 전환, 기존 프로세스 종료, 재부팅 없음.
- 완료 기준: 예약 작업 Running, 모의 모드 및 실제 시세 API 응답, 로컬/서버 전체 테스트 통과를 확인하여 서버 준비는 리뷰 대기로 전환.
- 남은 검증: 최소 1회 240분봉 마감 포함 V3 연속 운영 및 재부팅/실패 복구 실증. 다음 봉 마감 예정값은 1792897203000 UTC ms.
- 로그: C:\ast\logs\paper-YYYY-MM-DD.log, 데이터: C:\ast\data\paper. 실행 중 날짜가 바뀌어도 로그 파일은 시작일 파일로 유지된다.

### 개발 PC에서 대시보드 보기

아래 터널을 켜 둔 상태에서 http://127.0.0.1:8788 에 접속한다.

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:8788:127.0.0.1:8787 pc@192.168.219.183
```
## 2026-10-25 후속 작업 로그: 실제 장애 복구

- 기존 작업 스케줄러의 RestartCount=999/RestartInterval=1분 설정만으로는 Node 강제 종료 후 복구되지 않았다. 종료 결과 4294967295와 정규화한 1 모두 Ready 상태에 남았다. 스케줄러 원인은 미확정이다.
- run-paper.ps1을 수정하여 전역 mutex를 유지한 채 Node 종료 후 60초 대기하고 순차 재시작하도록 했다. 동시 프로세스 시작 없이 기존 잔고/데이터 경로를 그대로 사용한다.
- 정상 종료 코드 0도 상시 운영 중 예기치 않은 종료로 취급하여 재시작한다. 계획된 운영 중지는 Node만 종료하지 말고 AST-Paper-Trader 예약 작업 전체를 중지해야 한다. 중지 전 포지션 확인 규칙은 그대로 적용한다.
- 세 번째 실제 시험: 무포지션 paper PID 3484를 종료, 60.385초 뒤 PID 2168로 복구. 작업 Running, mode=paper, 현금 10,000,000원, 코인 0, position=null, lastError=null, error 이벤트 0을 확인했다.
- 최초 실패와 두 번째 실패 뒤에는 수동 재기동했다. 세 번째 시험은 수동 시작 없이 실행 스크립트가 복구했다.
- PowerShell 파서 오류 없음. Node 매매 핵심은 변경하지 않았다.
- 남은 검증: 실행 호스트인 PowerShell 자체 장애, 실제 재부팅, 봉 마감 포함 V3. 다음 봉 확인 예정은 2026-10-25 12:00:03 KST이며 아직 도달하지 않았다.
- 서버 OS의 표시 시간대는 -07:00으로 관측됐다. 공용 서버의 시간대는 변경하지 않았으며 운영 이벤트 UTC ms를 KST로 변환하여 검증했다. 기존 콘솔 로그의 현지 시각 표시는 KST와 다를 수 있다.

## 봉 마감 관측 도구 명세 (2026-10-25)

- 수정하는 파일: scripts/server/observe-paper.mjs, test/server-observer.test.js 및 기존 서버 작업/협업 기록.
- 목적: 로컬 API를 30초 간격으로 조회하고 최초 nextCandleAt에서 5분까지 관측한다. 유한 시간 종료, API 요청은 10초 제한.
- 완료 기준: paper 모드 유지, 최초 signal.at보다 진행한 마감봉 신호 확인, 관측 중 API 실패/오류 이벤트/재시작 없음. 불충족 시 실패 보고서를 저장한다.
- 출력: C:\ast\logs\paper-observation.json. API 키와 전체 설정은 저장하지 않는다.
- 테스트: 가짜 fetch로 봉 전진, live 모드 거부, 과거 봉 무시, 관측 오류/재시작/기한 초과 검출.
- 실제 봉 마감 전에는 검증 완료로 표시하지 않는다.

### 봉 마감 관측 도구 작업 로그

- 가짜 fetch 테스트 9개 추가: 봉 전진, 기한 초과, live 모드 거부, 매매 루프 오류, 재시작, 오류 이벤트, 연결 실패, 잘못된 봉 정보, 과거 이벤트 구분.
- 로컬 및 서버 npm test 각각 118/118 통과.
- 서버에서 관측 프로세스 PID 1984 기동. 첫 보고서 state=running, samples=1, issues=[] 확인.
- 기준 signal.at=1792868400000, 목표 마감=1792897203000(2026-10-25 12:00:03 KST), 기한=1792897503000(12:05:03 KST).
- 단발성 검증 프로세스이며 성공/실패 결과 저장 후 종료한다. 보고서 state가 running이고 lastSampleAt이 오래됐다면 관측 프로세스가 중단된 것이므로 통과로 해석하지 않는다.
- 실패 판정은 연속 관측의 엄격한 기준이다. 일시적 연결 오류도 실패로 남기며, 관측 실패 자체가 거래 손실을 의미하지 않는다.
- /api/events는 최근 80건이므로 30초 사이에 80건을 넘는 이벤트가 발생하면 일부 과거 이벤트를 놓칠 수 있다. 이 도구는 전체 이벤트 감사나 가용성 보증이 아니다.
- 이전 문서 편집에서 손상된 BOARD 표 구분자 및 MESSAGES 삽입 위치를 복구했다.
- 호스트 장애/실제 재부팅 검증은 아직 수행하지 않았다.
- 후속 확인에서 Start-Process로 띄운 PID 1984는 SSH 세션 종료와 함께 종료되고 샘플이 1개에 머무는 문제를 발견했다.
- AST-Paper-Observation 예약 작업을 SYSTEM/수동 시작/트리거 없음/반복 없음/최대 실행 6시간으로 등록해 검증기를 다시 시작했다. 기존 자동매매 작업은 중지하거나 변경하지 않았다.
- 최종 관측 시작 시각은 1792889780952 UTC ms이며 보고서를 새로 시작했다. 실제 작업 내 관측은 목표 봉+5분 또는 최대 5시간 내 종료한다.
- 결과 확인: C:\ast\logs\paper-observation.json의 state=passed/failed 및 finishedAt. 재실행은 이전 보고서를 보관한 뒤 수동으로만 한다.
- SSH 종료 후 재조회: samples=4, issues=[], lastSampleAt=1792889871035. AST-Paper-Observation/AST-Paper-Trader 모두 Running. 도구 구현은 리뷰 대기, 봉 마감 결과는 아직 진행 중.

## 읽기 전용 운영 점검 명세 (2026-10-25)

- 수정하는 파일: scripts/server/check-paper.mjs, test/server-check.test.js, 이 문서와 협업 기록.
- 명령: 서버 C:\ast에서 node scripts/server/check-paper.mjs. JSON 출력은 --json.
- API는 10초 제한으로 GET /api/status만 조회한다. .env/키/전체 설정은 읽거나 출력하지 않는다.
- 모드, 현재가, 잔고, 포지션 유무, 최근 오류 유무 및 봉 처리 예정 시각을 요약한다. 봉 예정 시각이 5분 이상 지났으면 오류.
- 관측 보고서가 running이고 마지막 샘플이 90초 초과 지연되면 경고. failed/누락/잘못된 보고서도 경고. passed는 과거 관측의 통과이며 현재 서버 정상 여부와 별도 표시.
- 종료 코드: 정상 0, 서버 오류 1, 관측 경고만 있으면 2. 시각은 KST, 금액은 KRW.
- 완료 기준: fake fetch 기반 테스트, npm test 전체 통과, 서버 읽기 전용 실행 확인. 자동 재시작/주문/알림은 수행하지 않는다.

### 운영 점검 작업 로그 및 개발 경로 이동

- 사용자 요청으로 개발 프로젝트 전체 내용을 C:\git\ast에서 C:\git\Bit-O\ast로 이동했다. .git, 미커밋 변경, 숨김 파일, 의존성 폴더를 포함한 최상위 16개 항목을 이동했고 Git 상태를 확인했다.
- 기존 C:\git\ast는 현재 세션 잠금 때문에 빈 폴더만 남아 있다. 서버 C:\ast는 이동 대상이 아니며 자동매매와 관측 작업은 계속 실행된다.
- check-paper.mjs: 읽기 전용 운영 점검, JSON/한국어 출력, KST 표시, 서버 오류/관측 경고 구분. 관측 파일 갱신 중단과 근거 없는 통과 표시를 검출한다.
- 전용 테스트 15개 추가. 이동 전·이동 후 로컬 및 서버 npm test 133/133 통과, git diff --check 통과.
- 서버 실제 실행: errors=[], warnings=[], exitCode=0, paper 모드, 현금 10,000,000원, 코인 0, 포지션 없음. 관측 running/samples=19 확인 (점검 시각 1792890330754 UTC ms).
- 서버에서 C:\ast로 이동 후 node scripts/server/check-paper.mjs 실행. 구조화 출력은 --json. 현황 조회만 하며 매매 프로세스를 재시작하지 않는다.
- 도구 구현/배포는 리뷰 대기. 12:00 KST 봉 마감 검증은 아직 진행 중이며 호스트 장애/재부팅 실증은 남아 있다.

## 실행 스크립트 회귀 검증 명세 (2026-10-25)

- 수정하는 파일: scripts/server/run-paper.ps1, test/server-runner.test.js 및 협업 기록.
- 경로/재시도 간격/뮤텍스 이름을 매개변수화한다. 운영 기본 C:\ast, 60초, Global\AST-Paper-Trader 유지.
- Node 프로세스 TZ=Asia/Seoul, 로그 파일 날짜도 KST로 계산한다. 서버 전역 시간대는 변경하지 않는다.
- 테스트는 임시 프로젝트와 고유 뮤텍스를 사용한다. 모의투자 환경 강제, 비정상 종료 후 재실행, 중복 실행 거부를 실제 PowerShell/Node로 확인한다. Windows가 아닌 환경에서는 명시적으로 건너뛴다.
- 테스트 자식 프로세스만 종료·정리하며 운영 AST 프로세스는 건드리지 않는다.
- 완료 기준: 전체 npm test 통과, 서버 임시 프로젝트에서도 검증. 운영 중 관측은 계속 유지한다.

### 실행 스크립트 회귀 검증 작업 로그

- run-paper.ps1에 ProjectRoot/NodePath/RetrySeconds/MutexName 매개변수 추가. 운영 기본값은 기존대로 유지한다.
- TZ=Asia/Seoul 강제 및 UTC+9 기준 로그 파일 날짜 적용. 시작 파일/Node 누락 오류 문구를 한국어로 변경했다.
- 격리된 임시 프로젝트에서 첫 Node 프로세스 종료 코드 7 → 재시작, 두 번째 실행기의 mutex 차단, MODE=paper/LIVE_CONFIRM=NO/HOST=127.0.0.1/PORT=8787 강제, 실제 Node 시간대 offset=-540을 검증했다.
- 시작 파일이 없으면 비정상 종료하는 경우도 검증했다. 테스트는 직접 생성한 임시 프로세스 트리만 정리한다.
- 첫 테스트 실행에서는 테스트 파일 작성 중 줄바꿈 이스케이프 오류로 실패했다. 수정 후 전용 2개 및 로컬·서버 전체 135/135 통과.
- 서버 스크립트 파일과 테스트 배포 완료. 운영 Node PID 2168 유지, 오류/경고 없음, 관측 32회 진행 중 확인(1792890739320 UTC ms).
- KST 설정은 다음 실행기 시작부터 활성화된다. 현재 실행 중 PowerShell의 기존 루프에는 파일 변경이 소급 적용되지 않으며, Node만 재시작해도 새 실행기 설정이 적용된다고 보장할 수 없다. 봉 마감 관측 종료 후 안전하게 예약 작업을 재기동할 때 반영한다.
- 실제 재부팅 및 실행 호스트 자체 장애 복구는 미검증이다. 이번 테스트는 자식 Node 실패와 mutex 동작 범위이며 그 이상을 보장하지 않는다.

## 잔존 Node 중복 기동 방지 명세 (2026-10-25)

- 수정하는 파일: scripts/server/run-paper.ps1, test/server-runner.test.js 및 협업 기록.
- 실행기가 mutex를 소유해도 같은 프로젝트의 절대 src/index.js 경로로 실행 중인 Node가 있으면 새 프로세스를 시작하지 않고 재시도 간격만큼 대기한다.
- 기존 프로세스 종료/포지션 변경은 하지 않는다. 프로세스 조회 실패 시 새 Node 시작을 중단한다.
- 실제 실행기가 사용하는 절대 경로를 대상으로 검사한다. 수동 상대 경로 실행, 권한으로 숨겨진 명령줄, 외부 수동 동시 시작까지 원자적으로 차단하는 장치는 아니다.
- 완료 기준: 임시 프로젝트 Node 잔존 시 기동 차단, 잔존 Node 종료 후 기동 재개, 전체 테스트 통과. 운영 프로세스를 종료하지 않고 검증한다.

### 잔존 Node 보호 작업 로그

- 실행기 시작마다 같은 절대 src/index.js 경로의 Node 프로세스를 조회한다. 남아 있으면 새 실행을 대기하며 기존 프로세스를 종료하지 않는다.
- 임시 프로젝트에서 잔존 Node 동안 새 기동 없음, 잔존 Node 종료 후 기동 재개를 실제 검증했다.
- 테스트 정리 과정에서 signalCode로 종료된 자식을 살아 있다고 잘못 판단하는 문제가 발견됐다. exitCode와 signalCode를 함께 검사하도록 수정하고 해당 테스트 전용 프로세스 트리를 식별·정리했다.
- 로컬 전체 테스트 중 Windows 프로세스 기동/조회가 기존 12초 제한을 초과했다. 검증 조건은 유지하고 대기 30초, 통합 테스트 전체 제한 90초로 조정했다.
- 최종 로컬 전체 136/136 통과. 서버 전체 136/136 통과 및 최종 대기 제한 반영 후 실행기 전용 3/3 재통과.
- 서버 파일 배포 완료. 운영 PID 2168 유지, paper/오류 0/경고 0, 관측 49회 진행 중 확인(1792891250366 UTC ms).
- 기존 실행 중 PowerShell에는 소급 적용되지 않는다. 새 실행기를 시작할 때 KST 설정과 잔존 Node 검사가 적용된다.
- 실제 PowerShell 장애 복구/재부팅 실증 및 240분봉 마감 관측은 여전히 미완료다. 잔존 Node 검사는 동일 절대 entry 경로를 사용한 실행 범위의 보호다.

## 실행 호스트 복구 예약 트리거 명세 (2026-10-25)

- 수정하는 파일: scripts/server/install-paper-task.ps1, test/server-task.test.js 및 협업 기록.
- 부팅 트리거와 별도로 1분 반복 트리거를 등록한다. MultipleInstances=IgnoreNew로 실행 중 재기동은 무시한다.
- 기존 작업은 명시적 갱신 옵션으로만 수정하며 지정 이름/실행 파일/runner 인자/SYSTEM 계정이 일치하는지 검사한다. 운영 프로세스는 중지하지 않는다.
- 갱신 후 계획된 정지는 작업을 먼저 비활성화하고 중지해야 한다. Stop만 하면 다음 반복 시각에 다시 시작할 수 있다.
- 완료 기준: 기존 작업 보호와 생성 동작 테스트, 전체 테스트 통과, 서버 격리 시험 작업의 PowerShell 종료 후 새 PID 자동 기동 확인, 기존 운영 PID 유지.
- 전체 서버 재부팅은 다른 앱도 중단하므로 이 시험의 범위에 포함하지 않는다.

### 실행 호스트 복구 예약 트리거 작업 로그 (연결 중단으로 실증 대기)

- install-paper-task.ps1에 ProjectRoot/TaskName/UpdateExisting 인자와 부팅+무기한 1분 반복 트리거를 추가했다. IgnoreNew 유지.
- 기존 작업 갱신은 실행 경로, runner 인자, 작업 디렉터리, SYSTEM 계정, MultipleInstances 일치를 검사하고 트리거만 수정한다. 갱신 경로에서는 Start/Stop을 호출하지 않는다.
- 가짜 Windows 예약 작업 함수로 생성, 기존 작업 거부, 갱신 대상 없음, 실행 정보 불일치 거부, 정상 갱신의 5개 시나리오 통과. 로컬 전체 npm test 141/141 통과.
- 새 설치기/테스트 파일은 서버로 전송됐다. 하지만 운영 AST-Paper-Trader의 트리거 갱신은 아직 실행하지 않았다. 새 복구 기능이 적용됐다고 해석하면 안 된다.
- 격리 시험용 C:\ast\logs\host-recovery-probe-20261025\scripts\server\run-paper.ps1 파일 생성까지 완료. PID/시각만 기록하고 대기하는 스크립트이며 매매 코드가 아니다.
- 첫 시험 작업 설치는 PowerShell 기본 실행 정책에 의해 차단됐다. 시스템 정책은 변경하지 않았다. 해당 호출 프로세스에만 -ExecutionPolicy Bypass를 지정해 재시도하려 했으나 이후 SSH 접속이 연속 시간 초과되어 설치·종료·복구 시험은 수행하지 못했다.
- 마지막 정상 서버 조회는 1792892934489 UTC ms: 관측 106회, 오류/경고 0, 무포지션. 이후 현재 서버 실행 상태와 봉 마감 결과는 확인되지 않았다.
- 개발 PC의 기본 경로는 Wi-Fi → 192.168.219.1로 확인됐다. 서버 전원/네트워크 장애 원인은 미확정이다.
- 연결 회복 시: AST-Test-HostRecovery-20261025 존재 여부 확인 → 없으면 준비된 probe 경로로 설치 → 실행 중 probe PID 검증 후 해당 PowerShell만 종료 → 다음 1분 트리거의 새 PID 확인 → 시험 작업 비활성화/중지/등록 해제 → 운영 작업 UpdateExisting 적용 후 기존 PID 유지 확인. 운영 재부팅은 하지 않는다.
- 새 반복 트리거를 운영에 적용한 뒤 계획된 중지는 Disable-ScheduledTask -TaskName AST-Paper-Trader 후 Stop-ScheduledTask -TaskName AST-Paper-Trader 순서로 한다. 보유 포지션이 있으면 기존 규칙대로 사용자 확인이 먼저다. 재개 시 Enable-ScheduledTask 후 Start-ScheduledTask를 사용한다.
- 실서버 검증 전까지 서버 전체 테스트는 이전 136/136 결과이며 새 테스트 포함 141/141 결과는 로컬에 한정된다.

### 서버 연결 재확인

- 사용자 계속 요청 후 SSH를 다시 시도했으나 연결 시간 초과.
- 공유기 192.168.219.1은 ping 응답(11ms), 서버 192.168.219.183은 ping 시간 초과 및 ARP 항목 없음.
- 기존 컴퓨터 이름 DESKTOP-FIRUT4I도 이름 조회 실패.
- 전원 꺼짐, 네트워크 분리, IP 변경 중 어느 원인인지는 확정하지 않았다. 사용자에게 서버 전원/연결과 IP 확인을 요청했다.
- 연결되지 않은 상태에서 서버 설정이나 방화벽을 변경하지 않았다. 반복 트리거의 실서버 검증·운영 적용은 계속 미완료다. 로컬 코드 변경 없음, 이전 141/141 테스트 결과 유지.

## Tailscale 접속 (2026-10-25 사용자 지정)

- Tailscale 피어: bito-server, DNS bito-server.tailf82f2c.ts.net, 주소 100.97.115.109.
- 기존 서버 SSH 호스트 키를 HostKeyAlias로 대조해 동일 서버 DESKTOP-FIRUT4I임을 확인했다. 새 키를 무검증 수락하거나 방화벽을 변경하지 않았다.
- 기존 LAN 주소 접근 실패는 서버 프로세스 중단을 의미하지 않았다. Tailscale 조회 시 운영 Node PID 2168 유지, 관측 214회, 오류/경고 0 확인.
- 명령: ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes -o HostKeyAlias=192.168.219.183 pc@100.97.115.109 hostname
- 원격 명령/파일 전송도 동일한 StrictHostKeyChecking/HostKeyAlias 옵션과 Tailscale 주소를 사용한다. 개인키는 기존 개발 PC에 둔다.

### Tailscale 경유 복구 검증 및 운영 적용

- AST-Test-HostRecovery-20261025 격리 작업을 같은 설치기로 생성: BootTrigger와 무기한 PT1M 트리거 확인.
- 시험 PowerShell PID 11412만 종료(1792896278445 UTC ms). 26.275초 후 PID 10144로 자동 복구, Running 확인. 운영 자동매매를 종료하지 않았다.
- 서버 전체 npm test 141/141 통과.
- 시험 작업은 비활성화 → 중지 → 등록 해제로 정리했고 등록 없음 확인. 시험 기록은 C:\ast\logs\host-recovery-probe-20261025에 보존했다.
- 운영 AST-Paper-Trader에 UpdateExisting 적용: 기존/이후 Node PID 2168 동일, Running 유지, 트리거 2개(부팅/1분 반복) 확인.
- 이제 PowerShell 자체가 종료돼도 다음 반복 트리거가 실행기를 시작할 수 있다. 실행 중에는 IgnoreNew로 중복 실행을 무시한다. 전체 서버 재부팅 시험은 하지 않았다.
- 계획된 중지는 반드시 Disable-ScheduledTask -TaskName AST-Paper-Trader 후 Stop-ScheduledTask -TaskName AST-Paper-Trader. Stop만 하면 다음 트리거에서 재기동될 수 있다.
- 실행 중 PowerShell을 교체하지 않았으므로 KST 환경/잔존 Node 검사 변경의 활성화는 다음 실행기 시작 때다. 반복 트리거 자체는 현재 운영 작업에 적용됐다.

### 최종 봉 마감 검증 및 실행기 설정 활성화

- 관측 보고서 state=passed, samples=249, issues=[].
- 시작 1792889780952, 완료 1792897223986 UTC ms(2026-10-25 12:00:23 KST). 약 2시간 4분 연속 관측 중 API 오류/시작 이벤트 없이 마감봉 신호가 1792868400000 → 1792882800000으로 4시간 전진했다.
- 봉 마감 완료 후 paper/무포지션/coin=0/lastError=null을 재확인하고 AST 작업만 Disable → Stop → 리스너 종료 확인 → Enable → Start 순서로 재기동했다.
- 운영 Node PID 2168 → 4680. 모의자금 10,000,000원, 코인 0, 포지션 없음, 오류 없음, 갱신된 signal.at 유지.
- 새 실행기는 KST 및 잔존 Node 검사 코드로 시작했다. 새 로그 C:\ast\logs\paper-2026-10-25.log에 [2026. 10. 25. 오후 12:02:17] start 확인.
- 봉 관측 보고서는 완료된 과거 검증 기록으로 유지한다. 새 재기동 이후 상태는 운영 점검 명령으로 별도 확인한다.
- 현재 결과: Tailscale SSH 확인, 로컬/서버 전체 141/141, 격리 실행 호스트 복구 26.275초, 운영 1분 트리거 적용, 봉 마감 V3 통과, 새 실행기 활성화 완료.
- 전체 서버 재부팅은 하지 않았다. 다른 프로젝트 프로세스/방화벽/키 설정은 변경하지 않았다. 코드·운영 작업은 Claude 리뷰 대기로 둔다.

## 2026-10-25 T-009A 성과 화면 반영

Codex: web/index.html, style.css, app.js, performance.js를 Tailscale로 배포. API/매매 코어/설정 변경 및 프로세스 재시작 없음. HTTP 성과 탭·달력 확인, 모듈 200/text/javascript, 4개 SHA256 로컬과 일치. UTC ms 1792930669377 확인: PID 4680, paper 잔고 1,000만 원/무포지션, 오류·경고 0. 로컬 전체 테스트 148/148 및 모의 API 브라우저 114/114 통과. 명세/검증: docs/tasks/T-009A-performance-calendar.md.

### 2026-10-25 T-009A 키보드 후속

Codex: web/index.html, app.js, performance.js 세 정적 파일 반영. 탭/날짜 키보드 조작 및 도움말 추가, HTTP 코드와 SHA256 일치 확인. UTC ms 1792931057713: PID 4680 유지/paper 오류·경고 0. 로컬 전체 150/150, 브라우저 132/132 통과. 재시작/설정/매매 코어 변경 없음.

### 2026-10-25 T-009A 월별 CSV

Codex: index.html/app.js/performance.js 3개 정적 파일 반영. 월별 청산 거래 CSV 저장 버튼 및 모듈 HTTP 확인/해시 일치. UTC ms 1792931896669: PID 4680 유지, paper 오류·경고 0. 로컬 전체 154/154 및 모의 API 브라우저 150/150 통과. 서버 재시작/설정/API/매매 코어 변경 없음.

### 2026-10-25 T-009B 전략 기록 및 성과

Codex: src/position.js, trader.js, backtest.js 및 web/index.html, app.js, performance.js 반영. 기존 코어 HEAD 일치/백업/준비 해시 확인 후 paper 무포지션 상태에서 AST만 계획 재기동했다. PID 4680→5852, 127.0.0.1:8787 바인딩 유지. 배포 6개 해시 일치 및 전략 표/모듈 HTTP 확인. 테스트 4개도 반영하고 서버 npm test 160/160 통과. UTC ms 1792933558041: 1,000만 원/coin 0/무포지션/오류·경고 0.

소스 백업 logs/T009B-before, 전송본 logs/T009B-stage. 테스트 백업은 .bak 확장자로 보존. 기존 봉 관측 passed 보고서는 logs/T009B-before/paper-observation.json에 보존하고 AST-Paper-Observation을 다시 시작했다. 신규 보고서 running/1회, 목표 2026-10-26 00:00:03 KST. 새 V3 통과는 아직 아니며 다음 작업에서 결과 확인 필요. 로컬 전체 160/160, 브라우저 156/156, BTC/ETH/XRP V2 모두 통과. 세부: docs/tasks/T-009B-strategy-performance.md.
