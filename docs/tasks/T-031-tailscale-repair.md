# T-031 개발 PC Tailscale 복구

사용자 요청: Tailscale 고쳐줘.

## 수정하는 파일
- docs/tasks/T-031-tailscale-repair.md
- docs/collab/BOARD.md, MESSAGES.md, VERIFY.md
- logs/T031-*

## 범위와 완료 기준
- 로컬 Windows Tailscale 상태 진단·필요시 서비스 재시작/기존 연결 복구. 관리자 권한 필요한 명령은 승인 경로 사용.
- 기존 키·프로필 삭제, 방화벽 완화, 서버 매매 프로세스 변경 없음. 대화형 로그인이 필요하면 사용자에게 맡긴다.
- 로컬 Running/가상IP 확인 및 bito-server 연결, 기존 HostKeyAlias로 SSH hostname 읽기 검증.
- 연구 T030은 복구 중 보류, T029 기존 검증 결과 보존. 서버 변경은 Claude 소유이므로 조회만 한다.

## 작업 로그
- 2026-10-27 서비스Running/Automatic이나 backend NoState·IP/피어 없음. 샌드박스 파이프 접근거부는 권한 확장 조회로 구분함.
- 서비스 재시작은 Windows 서비스 제어권한 부족으로 실패, 실제 재시작 없음. 승인된 `tailscale up --timeout=20s`로 기존 프로필 연결 성공(exit0). 새 인증/키 삭제/재설치 불필요.
- backend Running, 로컬100.82.116.60/Online, Health=[] 및 bito-server100.97.115.109/Online 확인. 기존 HostKeyAlias=192.168.219.183/StrictHostKeyChecking=yes로 SSH hostname=DESKTOP-FIRUT4I, exit0.
- V4 연결 확인 완료. 애플리케이션 코드 변경이 없어 이 작업 단독 npm test/V2 대상 아님. 서비스·프로필 초기 상태 원인은 미확정이며 재부팅 후 자동 연결 지속성은 미검증. 서버 프로세스·방화벽 변경 없음. 리뷰 대기.
