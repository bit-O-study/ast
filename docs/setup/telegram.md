# 텔레그램 알림 설정

T-003은 알림 모듈입니다. `.env`를 읽거나 매매 루프에 자동 연결하지 않습니다. 애플리케이션 설정 연결은 T-008에서 진행합니다. 토큰 또는 chat ID가 비어 있으면 전송하지 않습니다.

## 1. 봇 만들기

1. Telegram에서 공식 [@BotFather](https://t.me/BotFather)를 엽니다.
2. `/newbot`을 보내고 안내에 따라 이름과 사용자 이름을 정합니다.
3. 발급된 토큰을 개인적으로 보관합니다. 토큰은 비밀번호처럼 취급하고 저장소·스크린샷·로그에 넣지 않습니다.
4. 새로 만든 봇과 개인 대화를 열고 **시작**을 누른 뒤 `AST 연결 확인` 같은 메시지를 직접 보냅니다.

봇 생성과 토큰 발급 절차는 [Telegram 공식 튜토리얼](https://core.telegram.org/bots/tutorial#obtain-your-bot-token)을 따릅니다.

## 2. 내 chat ID 확인

저장소 폴더에서 PowerShell을 열고 실행합니다. 토큰은 입력창에 붙여 넣습니다. 명령 이력에는 실제 토큰이 들어가지 않습니다.

```powershell
$botTokenSecure = Read-Host 'BotFather 토큰' -AsSecureString
$botTokenText = [System.Net.NetworkCredential]::new('', $botTokenSecure).Password
try {
  $updates = Invoke-RestMethod -Method Get -TimeoutSec 10 -Uri ('https://api.telegram.org/bot' + $botTokenText + '/getUpdates')
  $updates.result | ForEach-Object {
    if ($_.message) {
      [pscustomobject]@{ ChatId = $_.message.chat.id; Type = $_.message.chat.type; Text = $_.message.text }
    }
  }
} catch {
  Write-Host '조회 실패: 토큰과 인터넷 연결을 확인하세요.'
} finally {
  $botTokenText = $null
  $botTokenSecure.Dispose()
}
```

직접 보낸 `AST 연결 확인` 메시지에 해당하는 `ChatId`를 사용합니다. 결과가 없으면 봇에게 새 메시지를 보낸 후 다시 조회하세요. 그룹 ID는 음수일 수 있으므로 부호까지 보존합니다.

이미 다른 프로그램이 같은 봇의 업데이트를 소비하거나 웹훅을 사용 중이면 조회가 안 될 수 있습니다. 기존 봇 설정을 임의로 지우지 말고 AST 전용 봇을 사용하세요. [getUpdates 공식 문서](https://core.telegram.org/bots/api#getupdates)

## 3. 모듈에 설정 전달

연결 코드 예시입니다. `token`, `chatId`, `store`는 호출자가 준비합니다. 이 예시를 실행하면 해당 대화방으로 알림이 전송됩니다.

```js
import { createTelegramNotifier } from './src/notify/telegram.js';

const notifier = createTelegramNotifier({
  token,
  chatId,
  types: ['buy', 'sell', 'close', 'stop', 'error', 'kill', 'pause', 'resume', 'ops'],
  onError: (error) => console.error(error.message),
});
const unsubscribe = store.onEvent((event) => notifier.notify(event));

// 프로그램 종료 시: 신규 이벤트 구독 해제 → 대기열 처리 → 종료
unsubscribe();
await notifier.flush({ timeoutMs: 5000 });
notifier.close();
```

T-008에 제안된 설정 키는 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_TYPES`입니다. T-008 연결 전에는 `.env`에 이 키를 추가해도 알림이 자동으로 켜지지 않습니다.

## 전송 동작과 제한

- KST 시각, 한국어 이벤트 종류, 이벤트의 `msg`를 일반 텍스트로 보냅니다.
- 기본 전송 간격은 1초, 대기열 상한은 50건입니다. 초과 시 가장 오래된 대기 알림을 버리고 `onError`로 알립니다. 전송 중인 1건은 상한에서 제외합니다.
- 같은 오류 메시지는 수신 시각 기준 60초 동안 억제합니다. 매수·매도 이벤트는 억제하지 않습니다.
- 요청과 응답 본문 읽기는 기본 10초 제한입니다. `timeoutMs`로 조절할 수 있습니다.
- HTTP 429일 때 `retry_after` 이후 한 번만 재시도합니다. 다른 오류는 재시도하지 않습니다. 응답을 못 받았어도 서비스가 이미 수신했을 수 있어 중복을 피하기 위한 동작입니다.
- `flush()`는 전송 중인 요청과 대기열이 끝날 때까지 기다립니다. `flush({ timeoutMs })`가 제한시간에 도달하면 `onError`로 알리고 반환하지만 전송 작업 자체는 계속됩니다. 중단하려면 `close()`를 호출합니다.
- `close()`는 대기 알림을 버리고 새 요청과 결과 콜백을 막습니다. 이미 시작된 요청은 완료 또는 요청 타임아웃까지 남을 수 있습니다.
- 대기열은 메모리에만 있습니다. 프로세스 종료·충돌 시 미전송 알림을 복원하지 않습니다. `flush()`가 끝나도 모든 알림의 성공을 의미하지 않으므로 `onError`를 확인하세요.
- [sendMessage의 4096자 제한](https://core.telegram.org/bots/api#sendmessage)에 맞춰 긴 메시지는 생략 표시를 붙여 잘라 보냅니다. 전체 이벤트 기록은 로컬 Store에서 확인합니다.

## 검증

개발 테스트는 실제 토큰이나 네트워크 없이 실행합니다.

```powershell
node --test test/telegram.test.js
npm test
```

실제 서비스 확인(V4)은 사용자가 정한 봇·대화방에서 `ops` 테스트 이벤트를 한 번 보내고 KST 시각과 본문 수신을 확인합니다. 그 뒤 종료해 추가 발송이 없는지 확인하고 `docs/collab/VERIFY.md`에 결과를 남깁니다. 실제 알림을 매매 루프에 연결한 후의 실시간 모의투자(V3)는 T-008에서 수행합니다.
