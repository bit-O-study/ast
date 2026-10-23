import crypto from 'node:crypto';

// 빗썸 API 2.0 인증: JWT(HS256) + 파라미터가 있으면 query_hash(SHA512)
// 해시 입력과 실제 요청 쿼리 문자열이 정확히 같아야 하므로 둘 다 이 함수 결과를 쓴다.
export function toQueryString(params = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => parts.push(`${k}[]=${x}`));
    else parts.push(`${k}=${v}`);
  }
  return parts.join('&');
}

export function signJwt(payload, secret) {
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const head = enc({ alg: 'HS256', typ: 'JWT' });
  const body = enc(payload);
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function buildToken(accessKey, secretKey, queryString = '', now = Date.now(), nonce = crypto.randomUUID()) {
  const payload = { access_key: accessKey, nonce, timestamp: now };
  if (queryString) {
    payload.query_hash = crypto.createHash('sha512').update(queryString, 'utf8').digest('hex');
    payload.query_hash_alg = 'SHA512';
  }
  return signJwt(payload, secretKey);
}
