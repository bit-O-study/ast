# T-001 전략 구조 개편 + BTC 국면 필터

- 담당: Claude · 상태는 `BOARD.md` 참고
- 선행: T-000
- 근거: `docs/PLAN.md` §2.3 (BTC 상승장 필터가 모든 조건에서 개선), §3 P2·P3

## 목표

1. 진입 판단을 **전략 단위**로 분리해 여러 전략을 같은 손절가·목표가 규칙으로 비교·운용할 수 있게 한다.
2. **BTC 국면 필터**를 넣는다. BTC 종가가 N일 평균 아래면 신규 매수를 하지 않는다.
3. 기존 점수 전략(`score`)과 **돌파 전략(`breakout`)**을 둘 다 제공한다.

## 수정하는 파일

- 새로 만듦: `src/strategies/index.js`, `src/strategies/score.js`, `src/strategies/breakout.js`, `src/regime.js`, `test/strategies.test.js`, `test/regime.test.js`
- 수정: `src/backtest.js`, `src/trader.js`, `src/config.js`, `src/server.js`, `src/cli/backtest.js`, `web/app.js`, `web/index.html`, `.env.example`, `README.md`, `test/backtest.test.js`, `test/trader.test.js`

## 설계

- 전략 인터페이스는 `CONTRACTS.md` C4.
- `score`: 기존 8개 지표 점수, `score ≥ ENTRY_SCORE`면 진입.
- `breakout`: 직전 20봉 고가 돌파 + 거래량이 20봉 평균의 1.5배 초과 + ADX > 20. 점수는 대시보드 표시용으로 함께 계산.
- 국면 필터 `src/regime.js`
  - `buildRegime(btcCandles, { unit, regimeDays })` → `{ isBull(t), ma, at }`
  - 이동평균 길이 = `regimeDays × 1440 ÷ unit` 봉. 판단 시각 `t`에 대해 **t 이전에 마감된 BTC 봉**만 사용 (미래 참조 금지)
  - 데이터가 부족하면 `isBull`은 `false` (보수적)
- 백테스트: 거래 대상이 BTC가 아니면 같은 기간 BTC 캔들을 함께 받아 필터를 만든다.
- 실매매: 봉 마감 때 BTC 캔들도 갱신하고, 필터에 막힌 신호는 `skip` 이벤트로 남긴다.
- 보유 중에 국면이 하락으로 바뀌어도 바로 팔지 않는다 (기존 이탈 규칙 그대로).

## 설정 키

| 키 | 기본값 | 설명 |
|---|---|---|
| `STRATEGY` | `score` | `score` 또는 `breakout` |
| `REGIME_FILTER` | `btc` | `btc` 또는 `off` |
| `REGIME_DAYS` | `20` | BTC 이동평균 기간(일) |

## 완료 기준

- 기존 테스트 전부 통과, 새 테스트 추가
- `REGIME_FILTER=off`, `STRATEGY=score`이면 기존과 같은 백테스트 결과
- 국면 필터가 미래 BTC 봉을 보지 않음을 테스트로 확인
- 대시보드 상태 API에 현재 전략과 국면(상승/하락) 표시

## 결정 사항

- `evaluate`는 `cfg`를 세 번째 인자로 받는다 (진입 기준 점수 등). CONTRACTS C4 갱신.
- 국면 판단 시각은 신호 봉의 **마감 시각**. 그 시각까지 마감된 BTC 봉만 쓴다.
- BTC 이동평균이 잡히지 않으면(데이터 부족) 하락으로 본다. 보수적으로 매수하지 않기 위해서다.
- 실매매에서는 BTC 시세를 (차트 봉 수 + 이동평균 길이)만큼 받아 차트 전 구간에 국면을 표시한다. 4시간봉이면 4h마다 2회 요청이 추가된다.
- 국면이 하락으로 바뀌어도 보유 포지션은 즉시 팔지 않는다. 기존 이탈 규칙(손절가 상향)이 처리한다.

## 작업 로그

- 2026-10-23 Claude: 작업 시작
- 2026-10-23 Claude: 완료
  - `src/strategies/{index,score,breakout}.js`, `src/regime.js` 추가. 백테스트·실매매·서버·CLI·대시보드 연결
  - 대시보드: 판단 패널에 전략 이름, 판단 이유, BTC 국면(종가 / 20일 평균) 표시. 차트에서 하락 국면 구간을 회색으로 표시
  - 테스트 34개 통과 (국면 미래 참조 금지, 하락 국면 진입 차단, 돌파 전략, 전략 인터페이스)
  - 빗썸 실제 시세 4시간봉 1,500개 (2026-02 ~ 10):
    | 설정 | 손익 | 거래 | 승률 | 손익비 |
    |---|---|---|---|---|
    | BTC · 점수 · 필터 끔 | −0.99% | 29 | 41% | 0.74 |
    | BTC · 점수 · BTC 필터 | +0.17% | 20 | 45% | 1.08 |
    | BTC · 돌파 · BTC 필터 | −0.42% | 10 | 30% | 0.73 |
    | ETH · 점수 · BTC 필터 | −1.42% | 19 | 26% | 0.63 |
  - 필터로 BTC는 개선됐지만 단독으로 수익 전략이 되지는 않음. 수수료(0.25% 가정)·진입 품질 개선은 T-006(지정가 진입), T-007(다중 코인)에서 이어서 다룸

## 리뷰

- (사용자)
