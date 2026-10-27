import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { authorizeUrl, exchangeCode, writeTokenFile, createKakaoNotifier } from '../src/notify/kakao.js';

// 카카오톡 "나에게 보내기" 최초 로그인 (T-035). 사용자가 직접 실행한다.
// 1) Kakao Developers 앱의 REST API 키(필요하면 Client Secret)를 입력
// 2) 브라우저에서 카카오 로그인·동의 → 이 스크립트가 인가 코드를 받아 토큰 파일 저장 → 테스트 메시지 전송
// 사용: node scripts/kakao-login.mjs [토큰 파일 경로, 기본 data/kakao-token.json]
// 이미 등록된 Redirect URI를 쓰려면 KAKAO_REDIRECT_URI=http://127.0.0.1:3000/... 로 지정 (그 주소·포트에서 직접 받는다)
// 키는 환경변수로도 받는다: node --env-file=<키가 든 env 파일> scripts/kakao-login.mjs
const tokenFile = process.argv[2] || 'data/kakao-token.json';
const redirectUri = process.env.KAKAO_REDIRECT_URI || 'http://localhost:8790/kakao';
const target = new URL(redirectUri);
if (target.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(target.hostname)) {
  console.error('Redirect URI는 이 PC 주소(http://localhost 또는 http://127.0.0.1)여야 합니다'); process.exit(1);
}
const port = Number(target.port || 80);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const clientId = (process.env.KAKAO_REST_API_KEY || await rl.question('REST API 키: ')).trim();
const clientSecret = (process.env.KAKAO_CLIENT_SECRET ?? await rl.question('Client Secret (안 쓰면 Enter): ')).trim();
rl.close();
if (!clientId) { console.error('REST API 키가 필요합니다'); process.exit(1); }

const state = randomBytes(16).toString('hex');
const url = `${authorizeUrl({ clientId, redirectUri })}&state=${state}`;
const page = (res, code, text) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' }); res.end(`<!doctype html><meta charset="utf-8"><p style="font:16px sans-serif">${text}</p>`); };

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirectUri);
  if (u.pathname !== target.pathname) return page(res, 404, '없는 주소입니다');
  if (u.searchParams.get('state') !== state) return page(res, 400, '요청이 올바르지 않습니다 (state 불일치). 스크립트를 다시 실행하세요.');
  if (u.searchParams.get('error')) {
    page(res, 400, `카카오 로그인이 취소됐습니다: ${u.searchParams.get('error')}`);
    console.error('로그인 취소:', u.searchParams.get('error'));
    return server.close(() => process.exit(1));
  }
  try {
    const token = await exchangeCode({ clientId, clientSecret, redirectUri, code: u.searchParams.get('code') });
    writeTokenFile(tokenFile, token);
    const notifier = createKakaoNotifier({ tokenFile });
    await notifier.test('카카오톡 알림 연결을 완료했습니다');
    page(res, 200, '완료했습니다. 카카오톡 "나와의 채팅"에서 테스트 메시지를 확인하고 이 창을 닫으세요.');
    console.log(`토큰 저장: ${tokenFile} (커밋 금지). 카카오톡으로 테스트 메시지를 보냈습니다.`);
    server.close(() => process.exit(0));
  } catch (e) {
    page(res, 500, `실패했습니다: ${e.message}`);
    console.error('실패:', e.message);
    server.close(() => process.exit(1));
  }
});
server.listen(port, target.hostname === 'localhost' ? '127.0.0.1' : target.hostname, () => {
  console.log(`브라우저에서 카카오 로그인 후 동의하세요. 창이 안 열리면 아래 주소를 여세요.\n${url}`);
  // Windows 기본 브라우저로 연다 (실패해도 주소로 진행 가능)
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url.replace(/&/g, '^&')], { stdio: 'ignore', detached: true }).unref();
});
setTimeout(() => { console.error('5분 동안 로그인이 없어 종료합니다'); process.exit(1); }, 5 * 60e3).unref();
