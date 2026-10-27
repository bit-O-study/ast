# T-035 카카오톡 알림 (나에게 보내기)

사용자 요청(2026-10-27): "카카오톡으로 알림 만들어줘". 텔레그램 알림(T-003)은 있었지만 매매 루프에 연결되지 않은 상태(T-008)였다. 이번 작업으로 카카오톡 알림을 이벤트 구독(C2)에 연결한다.

## 수정하는 파일
- 신규: src/notify/kakao.js, scripts/kakao-login.mjs, test/kakao.test.js
- 수정: src/config.js(NOTIFY_KAKAO, KAKAO_TOKEN_FILE), src/index.js(연결), src/server.js(/api/notify), web/index.html, web/verify.js, scripts/check-dashboard.mjs, .env.example
- docs/collab/CONTRACTS.md C6, docs/tasks/T-035, BOARD/MESSAGES/VERIFY

## 설계
- 카카오 REST API "나에게 보내기"(`POST kapi.kakao.com/v2/api/talk/memo/default/send`)를 쓴다. 기본 텍스트 템플릿이고 200자 제한이 있다. 무료이며 사업자 등록이 필요 없다. 알림톡은 쓰지 않는다.
- 인터페이스는 C6 텔레그램과 같다(`notify`, `flush`, `close`, `enabled`)에 `test()`를 더했다. `store.onEvent`에 연결한다.
- **키·토큰 보관:** REST API 키, Client Secret, 접근·갱신 토큰은 **토큰 파일(`data/kakao-token.json`)에만** 둔다. `.env`와 `cfg`에는 켜기/끄기와 파일 경로만 둔다. 그래서 `/api/status` 설정 노출이나 커밋으로 새어 나갈 수 없다(`data/`는 .gitignore 대상).
- **토큰 갱신:** 접근 토큰 만료 5분 전이거나 401이 나면 갱신하고 1회 재시도한다. 갱신 응답에 새 갱신 토큰이 오면 교체해 저장한다(파일은 원자적으로 교체). 갱신 토큰이 만료되면(invalid_grant) 알림을 끄고 "다시 로그인"을 로그에 남긴다.
- **보내는 이벤트:** buy, sell, close, error, kill, verify. stop은 자주 나와서 제외했다. 같은 오류는 30분에 한 번만 보낸다. 대기열은 50건이고, 넘치면 가장 오래된 것부터 버린다.
- **장애 격리:** 전송 실패는 콘솔 로그만 남긴다. 매매 루프는 멈추지 않는다(C2 구독 격리). 오류 문구에서 토큰·키는 가린다.
- **끄기:** `NOTIFY_KAKAO=off`(기본값). 외부 요청은 설정으로 끌 수 있어야 한다는 규칙을 따른다.
- **최초 로그인:** `node scripts/kakao-login.mjs`를 사용자가 직접 실행한다. 키를 입력받은 뒤, localhost:8790에서 인가 코드를 받아 토큰을 저장하고 테스트 메시지를 보낸다. CSRF 방지 state를 확인하고, 5분이 지나면 종료한다.
- **대시보드:** 검증 탭에 알림 상태와 "테스트 알림 보내기" 버튼을 두었다(`GET/POST /api/notify`).

## 사용자 준비 (Kakao Developers)
1. developers.kakao.com → 내 애플리케이션 → 앱 추가
2. 앱 키의 **REST API 키** 확인
3. 카카오 로그인 사용 설정을 켜고, Redirect URI에 `http://localhost:8790/kakao` 등록
4. 동의항목에서 **카카오톡 메시지 전송(talk_message)** 사용 설정
5. (선택) 보안 탭에서 Client Secret을 켰다면 로그인 때 함께 입력
6. 개발 PC에서 `node scripts/kakao-login.mjs` 실행 → 로그인·동의 → 카톡 "나와의 채팅"에서 테스트 메시지 확인
7. 토큰 파일을 서버 `C:\ast\data\kakao-token.json`으로 옮기고, 서버 `.env`에 `NOTIFY_KAKAO=on`을 넣은 뒤 재기동

콘솔 메뉴 이름은 카카오 개편에 따라 다를 수 있다.

## 완료 기준
- 가짜 fetch 테스트: 요청 형식, 종류 필터, 만료 전 갱신·저장·갱신 토큰 교체, 401 재시도, 갱신 토큰 만료 시 꺼짐, 키 노출 없음, 오류 반복 억제, 토큰 파일 없음, 코드 교환, 설정 검증, API
- npm test 전체 통과, 브라우저 점검 통과
- V4: 실제 카카오 계정으로 테스트 메시지 수신 확인(사용자 로그인 후)

## 결정 사항
- 2026-10-27 키·토큰을 .env가 아닌 토큰 파일 하나에 둔다. 서버 규칙("API 키 입력은 사용자만")에 따라 로그인은 사용자가 직접 실행한다.

## 작업 로그
- 2026-10-27 구현. kakao 테스트 9개 추가, 전체 281/281, 브라우저 204/204(알림 패널·테스트 버튼 포함). V4는 사용자 로그인 대기.
- 2026-10-27 사용자 지시로 C:gitBit-O 프로젝트들이 쓰는 같은 카카오 앱 키를 재사용했다(health_app/.env.local, 값 미출력). 이미 등록된 http://127.0.0.1:3000/api/support/kakao/callback으로 로그인하도록 스크립트에 KAKAO_REDIRECT_URI 옵션을 추가했다. 11:51 KST 토큰 저장, 테스트 전송 result_code 0. 서버 반영은 처음에 권한 검사로 거부됐고, 사용자 재지시 후 복사했다.
- 2026-10-27 a3c9a2a 배포 확인. 서버 /api/notify configured·enabled true, 서버에서 테스트 전송 ok(12:05 KST). V3 세션은 running, 재시작 경고 1건. V4(사용자 수신 확인) 대기.
- 2026-10-27 사용자 수신 확인("받았어") → V4 통과. 완료.
- 2026-10-27 후속 과제(보류): 알림 발신 이름이 health_app 카카오 앱(헬수)으로 표시된다. AST 전용 카카오 앱을 만들어 다시 로그인하는 작업은 사용자 결정으로 나중에 한다. 그때까지 현재 토큰으로 알림은 계속 보낸다.

