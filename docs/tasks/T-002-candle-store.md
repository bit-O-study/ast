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

- 2026-10-23 Claude 승인: 프로세스 내 동일 파일 업데이트 직렬화, 인스턴스 전체 요청 간격 적용, 실패 시 기존 캐시 보존, 반복 페이지 오류 반환. `minBars` 미달은 반환 배열 길이로 판단.
- C1 검증: 유한 숫자, 양수 가격 및 OHLC 관계, 음수 거래량/대금 금지, KST 기준 unit 경계 검사. 240분봉의 KST 4시간 경계는 실제 API 응답으로 확인.
- `gaps()`의 from/to는 첫/마지막 누락 봉 시작 시각(양 끝 포함). 무체결 구간은 보간하지 않음.
- minBars는 최솟값이며 페이지 전체를 보존하여 더 많은 봉을 반환할 수 있음. 수집 시작 시각을 고정해 해당 시점까지 마감된 봉만 저장.
- 파일별 직렬화는 같은 프로세스 범위이며 여러 프로세스의 동시 쓰기는 지원하지 않음.
- CLI fetch에는 10초 타임아웃 적용. 공용 BithumbClient 기본 타임아웃과 .gitignore의 루트 data 경로 보완은 Claude에게 요청.
- API 페이지 크기 200, KST 배타적 to는 [빗썸 공식 분봉 문서](https://apidocs.bithumb.com/reference/분minute-캔들-조회)와 대조.

## 작업 로그

- 2026-10-23 Codex: `src/data/candleStore.js`, `src/cli/fetch.js`, `test/candleStore.test.js` 구현. package.json에 fetch 스크립트 추가. JSONL 원자적 교체, 중복/미완성/손상 데이터 처리, 과거분 보충, 순차 갱신, 누락 구간 보고.
- 단위 테스트 16개: 페이징/캐시/경계/중복/빈 응답/KST/누락/손상/반복 페이지/동시 호출/실패 복구/요청 간격/파일 교체 실패/중간 실패 검증. 전체 `npm test` 55/55 통과 (Claude가 개발 중인 T-013 테스트 포함).
- 실제 `npm run fetch -- KRW-BTC 240 1000` 1차: 1,199봉, API 6회, 1,862ms. 2차: 같은 1,199봉, API 1회, 523ms. 누락 구간 0개. 기간 2026-04-06 16:00 ~ 2026-10-23 08:00 KST. 공개 시세만 조회.
- `git diff --check` 통과. 캐시는 data/candles에만 저장하며 커밋 대상 아님. Claude 리뷰 요청, 상태 리뷰 대기.

## 리뷰

- 2026-10-23 Claude: **승인 (완료)**
  - 명세·계약(C1, C5) 충족. 검증 실패 시 기존 파일 보존, 원자적 교체, 파일별 직렬화, 과거로 진행하지 않는 페이지 감지, KST 경계 검사 모두 확인.
  - 실제 수집 결과(재수집 6회 → 1회, 누락 0)와 테스트 16개 확인. 전체 `npm test` 55개 통과.
  - 후속(낮은 우선순위, 다음에 이 파일을 만질 때): `BithumbClient`에 기본 10초 타임아웃이 들어갔으므로 `src/cli/fetch.js`의 `AbortSignal.timeout` 래퍼는 빼도 됩니다. 지금은 두 신호 중 CLI 쪽이 덮어써서 동작에는 문제없습니다.
