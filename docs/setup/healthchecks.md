# 생존 감시와 공인 IP 감시 설정

T-004는 독립 모듈입니다. `.env`와 매매 루프 연결은 T-008에서 진행합니다. 설정 키만 추가해도 자동으로 켜지는 상태는 아닙니다.

## Healthchecks.io 준비

1. [Healthchecks.io](https://healthchecks.io/)에 로그인해 AST용 체크를 만듭니다.
2. 이름을 `AST 집 PC` 등으로 지정합니다.
3. Simple 스케줄에서 **Period 2분**, **Grace 3분**을 설정합니다. 모듈의 기본 전송 주기는 60초입니다.
4. 체크의 Ping URL을 복사합니다. URL 자체가 체크를 갱신할 권한이므로 공개 문서나 로그에 올리지 않습니다.
5. Integrations에서 이메일 또는 Telegram을 연결하고 해당 체크의 알림 대상으로 지정합니다.

Period는 정상 신호 간격, Grace는 신호가 늦었을 때의 추가 대기 시간입니다. 위 설정이면 마지막 정상 신호 후 약 5분 뒤 장애 알림 대상이 됩니다. [스케줄 공식 설명](https://healthchecks.io/docs/configuring_checks/), [알림 연결](https://healthchecks.io/docs/configuring_notifications/)

## 모듈 사용

아래 코드는 실제 URL을 전달하면 즉시 생존 신호를 보냅니다. `pingUrl`은 호출자가 준비합니다.

```js
import { startHeartbeat } from './src/ops/heartbeat.js';

const heartbeat = startHeartbeat({
  url: pingUrl,
  intervalSec: 60,
  onError: (error) => console.error(error.message),
});

// 치명적 오류나 킬 스위치 발생 시 호출자가 실행
await heartbeat.fail('AST 킬 스위치 작동');
heartbeat.stop();
```

`fail(message)`는 실패 경로로 POST합니다. 이후 정상 신호가 계속 전달되면 감시 서비스가 복구로 판단할 수 있으므로, 중단 상태를 유지하려는 호출자는 `fail()` 다음에 `stop()`해야 합니다. [Healthchecks Pinging API](https://healthchecks.io/docs/http_api/)

- URL이 비어 있으면 `enabled=false`이고 요청하지 않습니다.
- 생성 시 첫 ping, 이후 지정 주기로 ping합니다. 진행 중인 ping이 있으면 새 요청을 겹쳐 보내지 않습니다.
- ping과 fail은 순서대로 실행됩니다. 요청과 응답 본문에는 기본 10초 타임아웃이 적용됩니다.
- `stop()` 이후 새 요청과 오류 콜백을 막습니다. 이미 진행 중인 요청은 완료나 타임아웃까지 남을 수 있습니다.
- 생존 신호는 프로그램의 감시 타이머가 동작한다는 의미입니다. 주문 성공이나 전략의 정상 판단까지 보장하지는 않습니다.

## 공인 IP 변경 감지

```js
import { createIpWatcher } from './src/ops/ipWatcher.js';

const watcher = createIpWatcher({
  intervalSec: 300,
  onInitial: (ip) => console.log('시작 IP:', ip),
  onChange: (prev, next) => console.log('IP 변경:', prev, '→', next),
  onError: (error) => console.error(error.message),
});

// 프로그램 종료 시
watcher.stop();
```

첫 조회는 `onInitial`, 이후 변경은 `onChange`로 알립니다. 기본 조회 순서는 `api.ipify.org`, `ifconfig.me/ip`이며 잘못된 응답이나 연결 실패 시 다음 소스로 넘어갑니다. 모두 실패하면 기존 IP를 보존하고 오류를 알립니다. `current()`는 마지막으로 확인된 값이며 현재 시점의 조회 성공을 의미하지 않습니다. `check()` 실패 결과는 `null`입니다.

IPv4/IPv6 형식을 검사하고 IPv6 표기를 정규화합니다. 서로 다른 서비스가 IPv4와 IPv6를 반환하면 실제 회선 변경 없이도 변경 알림이 날 수 있습니다. 같은 주소 계열을 반환하는 `sources`를 지정할 수 있고, `sources: []`는 감시를 끕니다. IP 변경 시 빗썸 허용 IP와 대조하는 운영 절차는 T-008 연결 단계에서 적용합니다.

제안 설정 키: `HEARTBEAT_URL`, `HEARTBEAT_SEC`, `IP_WATCH_SEC`.

## 검증 절차

```powershell
node --test test/ops.test.js
npm test
```

실제 Healthchecks 확인은 사용자가 설정한 체크에 정상 ping을 보내 활성 상태를 확인한 뒤, 중지하고 Period+Grace 이후 알림을 확인합니다. 이 절차는 실제 휴대폰 알림을 발생시킵니다. 검증 후 체크를 일시정지하거나 정상 운영을 재개합니다.

공인 IP 실조회, 실제 서비스 알림(V4), 매매 루프 연결 후 실시간 모의투자(V3)는 구분해서 `docs/collab/VERIFY.md`에 기록합니다. 테스트용 가짜 fetch 성공을 실제 서비스 알림 성공으로 기록하지 않습니다.
