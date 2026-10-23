# T-002 캔들 수집·캐시

- 담당: Codex · 상태는 `BOARD.md` 참고
- 선행: T-000
- 쓰는 곳: 백테스트(긴 기간), 다중 코인(T-007), 검증 체계(T-012)

## 목표

빗썸 분봉 캔들을 로컬 파일에 저장하고, 다음부터는 **새로 생긴 봉만** 받아 이어 붙인다. 매번 수천 개를 다시 받지 않게 한다.

## 수정하는 파일

- 새로 만듦: `src/data/candleStore.js`, `src/cli/fetch.js`, `test/candleStore.test.js`
- 수정: `package.json`의 `scripts`에 `"fetch": "node src/cli/fetch.js"` **한 줄만** 추가

## 인터페이스

`CONTRACTS.md` C5를 따릅니다.

```js
export class CandleStore {
  constructor({ dir = 'data/candles', client, now = Date.now, sleepMs = 200 })
  load(market, unit)                         // C1 배열 (오래된 → 최신), 파일 없으면 []
  async update(market, unit, { minBars = 1000 } = {})  // 저장 후 전체 배열 반환
  gaps(market, unit)                         // [{ from, to, missing }] 빠진 봉 구간
}
export function toKst(t)  // UTC ms → 'yyyy-MM-ddTHH:mm:ss' (KST). 빗썸 `to` 파라미터용
```

## 동작

1. 파일: `${dir}/${market}_${unit}.jsonl`, 한 줄에 캔들 하나 (C1 형식).
2. `update`
   - 저장된 마지막 봉 이후의 새 봉을 받는다: `client.candles(market, unit, { count: 200 })`부터 시작해, 저장된 마지막 `t`와 겹칠 때까지 `to`로 과거를 거슬러 받는다.
   - 저장된 봉이 `minBars`보다 적으면, 가장 오래된 봉보다 더 과거를 `to = toKst(가장 오래된 t)`로 이어 받는다. 빗썸이 빈 배열을 주면 거기서 멈춘다 (상장 이전).
   - **마감된 봉만** 저장한다 (`t + unit*60000 <= now()`).
   - `t` 기준 중복 제거, 오래된 → 최신 정렬.
   - 저장은 임시 파일에 쓴 뒤 이름 변경(원자적 저장).
   - 요청 사이 `sleepMs`만큼 쉰다 (빗썸 제한 초당 150회지만 여유 있게 초당 5회 이하).
3. `client`는 `src/bithumb/client.js`의 `BithumbClient`. `candles()`는 이미 C1 형식, 오래된 → 최신으로 돌려준다.
4. 빗썸 `to`는 KST 시각이고 **그 시각의 봉은 제외**된다.

## CLI

```bash
npm run fetch -- KRW-BTC 240 3000         # 한 코인
npm run fetch -- KRW-BTC,KRW-ETH 60 5000  # 여러 코인
```

진행 상황(코인, 받은 개수, 기간 KST)과 빠진 구간 수를 출력한다.

## 테스트 (`fetchImpl` 대신 가짜 `client` 주입)

- 빈 저장소에서 `minBars`만큼 과거로 페이지를 넘겨 받는다
- 두 번째 `update`는 새 봉만 요청하고 이어 붙인다 (요청 횟수 확인)
- 미완성 봉은 저장하지 않는다
- 중복 `t`가 섞여 와도 하나만 남는다
- 빈 응답(상장 이전)에서 멈춘다
- `toKst(Date.UTC(2026,9,22,23))` → `'2026-10-23T08:00:00'`
- `gaps`가 빠진 봉을 찾는다
- 테스트는 임시 폴더(`fs.mkdtempSync`)를 쓰고 네트워크를 쓰지 않는다

## 완료 기준

- `npm test` 전체 통과
- 실제로 `npm run fetch -- KRW-BTC 240 1000`을 두 번 실행해 두 번째가 빠르게 끝나는지 확인하고 결과를 작업 로그에 적기

## 설정 키 (제안)

- 없음 (경로는 인자로)

## 결정 사항

-

## 작업 로그

-

## 리뷰

- (Claude)
