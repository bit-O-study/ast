# 공용 Windows 서버 SSH 접속 안내 (Codex용)

다른 프로젝트에서 이 문서를 읽고 같은 개발 PC의 Codex가 접속할 수 있습니다.
최종 확인: 2026-10-23, 공개키 로그인 성공.

## 접속 정보

| 항목 | 값 |
|---|---|
| 서버 주소 / 포트 | 192.168.219.183 / 22 |
| 서버 이름 | DESKTOP-FIRUT4I |
| SSH 계정 | pc |
| whoami 결과 | desktop-firut4i\pc |
| 운영체제 | Windows 11 Home, 10.0.26100 |
| 개발 PC 개인키 경로 | C:\Users\NB0075\.ssh\id_ed25519 |
| 개발 PC 공개키 경로 | C:\Users\NB0075\.ssh\id_ed25519.pub |
| 키 주석 | ast-claude (같은 PC의 Codex도 사용 가능) |
| 로그인 공개키 지문 | SHA256:3rdPwwwXFemlMehGOXkJLLwXnVavJSdA0BECgWoP6Ik |
| 서버 공개키 등록 파일 | C:\ProgramData\ssh\administrators_authorized_keys |
| SSH 방화벽 범위 | LocalSubnet, 같은 공유기 내부망 |

처음 전달된 컴퓨터명 desktio-firut4i에는 오타가 있었습니다. 실제 이름은 desktop-firut4i입니다.
위 지문은 로그인용 공개키의 지문이며 서버 호스트 키 지문과 다릅니다.

## 바로 접속하기

개발 PC PowerShell에서 실행합니다. 프로젝트 작업 폴더와 무관합니다.

```powershell
ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes -i C:/Users/NB0075/.ssh/id_ed25519 pc@192.168.219.183 whoami
```

정상 결과: `desktop-firut4i\pc`

대화형 접속:

```powershell
ssh -i C:/Users/NB0075/.ssh/id_ed25519 pc@192.168.219.183
```

현재 개발 PC의 known_hosts에 호스트 키가 등록되어 있습니다. 호스트 키 변경 경고가 나오면 검증 없이 기록을 지우거나 검사를 끄지 마세요.

## Codex 권한

- 샌드박스에서 사용자 .ssh 폴더나 사설망 접근이 거부되면 `exec_command`의 `sandbox_permissions=require_escalated`로 해당 접속 승인을 요청합니다.
- 개인키를 출력·복사·커밋하지 않습니다. `ssh -i`에 경로만 전달합니다.
- 비밀번호를 채팅이나 명령행에 넣지 않습니다. 기존 공개키 인증을 사용합니다.
- 이 문서는 접속 정보입니다. 서버 변경 범위는 각 프로젝트에서 사용자가 요청한 작업을 따릅니다.

## 원격 PowerShell 명령

로컬 PowerShell과 원격 셸의 따옴표 충돌을 피하려면 EncodedCommand를 사용합니다.
Base64는 암호화가 아니므로 비밀번호나 API 키를 스크립트에 넣지 마세요.

```powershell
$remoteScript = @'
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
whoami
Get-Service sshd | Select-Object Name, Status, StartType | ConvertTo-Json
'@
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remoteScript))
ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes -i C:/Users/NB0075/.ssh/id_ed25519 pc@192.168.219.183 "powershell -NoProfile -EncodedCommand $encoded"
```

서로 다른 종류의 객체를 이어 출력할 때는 `ConvertTo-Json`을 사용하거나 각각 `Format-List | Out-String`으로 출력합니다. 자동 표 형식 때문에 필드가 숨겨질 수 있습니다.
PowerShell에서 역슬래시로 큰따옴표를 이스케이프하지 마세요.

## 파일 전송

프로젝트 전용 경로를 만들고 기존 파일을 확인한 뒤 전송합니다. 아래 경로는 예시입니다.

```powershell
scp -o BatchMode=yes -o StrictHostKeyChecking=yes -i C:/Users/NB0075/.ssh/id_ed25519 ./release.zip pc@192.168.219.183:C:/projects/my-project/release.zip
```

`.env`, 개인키, 다른 프로젝트의 데이터는 업로드하지 않습니다.

## 다른 프로젝트에서 사용

이 파일을 해당 프로젝트의 `docs/setup/windows-server-ssh.md`에 복사하세요.
AGENTS.md 소유권 규칙에 따라 다음 안내를 추가하거나 Codex에 이 파일을 읽으라고 지시합니다.

```markdown
서버 작업 전 docs/setup/windows-server-ssh.md를 읽는다.
서버는 192.168.219.183, SSH 계정은 pc다.
서버 변경 전 프로젝트 작업 기록을 남기고 다른 프로젝트의 프로세스와 데이터를 보호한다.
```

## 공유 서버 운영 원칙

- 프로젝트별 폴더·포트·예약 작업 이름을 구분합니다. `C:\ast`는 자동매매 프로젝트용입니다.
- 변경 전 프로세스, 포트, 예약 작업, 대상 경로를 확인합니다.
- SSH의 LocalSubnet 제한을 유지하고 공유기 포트포워딩을 추가하지 않습니다.
- 요청 없이 재부팅하거나 다른 프로젝트 프로세스를 종료하지 않습니다.
- 설치와 설정 변경은 해당 프로젝트의 .md에 기록합니다.
- 자동매매는 모의투자로 실행합니다. 실거래 전환과 API 키 입력은 사용자만 합니다.
- 사설 IP이므로 다른 네트워크나 클라우드 실행 환경에서는 바로 접속되지 않습니다.
- 개발 PC가 달라지면 해당 PC의 공개키를 별도로 등록합니다. 기존 개인키를 복사하지 않습니다.

## 인증 오류 해결 기록

2026-10-23 공개키가 두 줄로 나뉘어 인증이 거부됐습니다. 서버 파일에서 `ssh-ed25519`, Base64 본문, 주석을 공백으로 구분한 한 줄로 수정한 뒤 로그인에 성공했습니다. 화면 자동 줄바꿈과 파일 안 실제 개행은 다릅니다.

확인된 파일 권한: `NT AUTHORITY\SYSTEM:(F)`, `BUILTIN\Administrators:(F)`.

서버 관리자 PowerShell에서 확인:

```powershell
Get-Content C:\ProgramData\ssh\administrators_authorized_keys
icacls C:\ProgramData\ssh\administrators_authorized_keys
```

다른 사용자의 키가 있을 수 있으므로 공개키 파일 전체를 임의로 덮어쓰지 마세요.
