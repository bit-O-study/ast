> 2026-10-27 T026 재계산: 보유기간 계산을 실제 경로에 맞춰 수정했다. [감사 기록](2026-10-27_execution-parity.md). 수정 전 자료는 logs/T026-before-parity/에 보존.

# 장기 추세 확인 연구 · 2026-10-26

T023 사전 고정3가설/2비교군·90개 비교. T018 시세 재사용/3연속구간/준비200봉. 별도1천만원 계좌·매수100만원 상한, 최초손절/청산 동일. 기본 편도 비용0.04%+슬리피지0.05%, 스트레스0.25%+0.10%(계정 요율 가정). 구간별 현금 재시작/끝 청산, 공백 보간 없음. 단일진입 백테스트 일일/누적손실 차단 미적용 제한 유지.

이미 본 데이터의 후속 탐색이며 독립 검증이 아니다. 후반 두 기간 모든 종목 양수·score 초과, 평균MDD/스트레스/거래수 조건을 동시에 요구한다. 상세 가설과 판정은 docs/tasks/T-023-long-trend.md.

- research_slopeMonth: **탈락**. 최근/KRW-BTC: 양수·기존 초과 동시 미충족 / 중기/KRW-ETH: 양수·기존 초과 동시 미충족 / 최근/KRW-XRP: 양수·기존 초과 동시 미충족
- research_aboveMonth: **탈락**. 중기/KRW-BTC: 양수·기존 초과 동시 미충족
- research_alignedMonth: **탈락**. 최근: 기존 대비 평균 수익률 개선 부족 / 최근: 수익 종목 2개 미만 / 최근: 비용 스트레스 평균 수익률 비양수 / 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-ETH: 양수·기존 초과 동시 미충족 / 최근/KRW-XRP: 양수·기존 초과 동시 미충족

| 종목 | 구간 | 비용 | 전략 | 거래 | 수익률 | MDD | PF |
|---|---|---|---|---:|---:|---:|---:|
| KRW-BTC | 초기 | 기본 | score | 27 | 3.363% | 1.053% | 2.384 |
| KRW-BTC | 초기 | 기본 | research_persistence | 21 | 3.138% | 0.907% | 2.365 |
| KRW-BTC | 초기 | 기본 | research_slopeMonth | 17 | 1.273% | 1.484% | 1.564 |
| KRW-BTC | 초기 | 기본 | research_aboveMonth | 21 | 3.138% | 0.907% | 2.365 |
| KRW-BTC | 초기 | 기본 | research_alignedMonth | 17 | 1.387% | 1.186% | 1.568 |
| KRW-BTC | 초기 | 스트레스 | score | 28 | 0.983% | 1.130% | 1.252 |
| KRW-BTC | 초기 | 스트레스 | research_persistence | 21 | 1.469% | 1.155% | 1.475 |
| KRW-BTC | 초기 | 스트레스 | research_slopeMonth | 17 | -0.193% | 1.975% | 0.936 |
| KRW-BTC | 초기 | 스트레스 | research_aboveMonth | 21 | 1.469% | 1.155% | 1.475 |
| KRW-BTC | 초기 | 스트레스 | research_alignedMonth | 17 | -0.070% | 1.532% | 0.978 |
| KRW-BTC | 중기 | 기본 | score | 24 | -0.641% | 1.166% | 0.803 |
| KRW-BTC | 중기 | 기본 | research_persistence | 16 | -0.474% | 1.048% | 0.776 |
| KRW-BTC | 중기 | 기본 | research_slopeMonth | 12 | 0.135% | 0.606% | 1.109 |
| KRW-BTC | 중기 | 기본 | research_aboveMonth | 15 | -0.162% | 0.860% | 0.910 |
| KRW-BTC | 중기 | 기본 | research_alignedMonth | 12 | -0.094% | 0.777% | 0.927 |
| KRW-BTC | 중기 | 스트레스 | score | 25 | -2.041% | 2.170% | 0.521 |
| KRW-BTC | 중기 | 스트레스 | research_persistence | 16 | -1.249% | 1.299% | 0.533 |
| KRW-BTC | 중기 | 스트레스 | research_slopeMonth | 12 | -0.449% | 0.702% | 0.732 |
| KRW-BTC | 중기 | 스트레스 | research_aboveMonth | 15 | -0.887% | 1.008% | 0.616 |
| KRW-BTC | 중기 | 스트레스 | research_alignedMonth | 11 | -1.209% | 1.257% | 0.351 |
| KRW-BTC | 최근 | 기본 | score | 11 | 1.055% | 0.631% | 2.454 |
| KRW-BTC | 최근 | 기본 | research_persistence | 9 | 1.099% | 0.288% | 3.407 |
| KRW-BTC | 최근 | 기본 | research_slopeMonth | 6 | 0.540% | 0.358% | 2.567 |
| KRW-BTC | 최근 | 기본 | research_aboveMonth | 9 | 1.099% | 0.288% | 3.407 |
| KRW-BTC | 최근 | 기본 | research_alignedMonth | 5 | -0.043% | 0.328% | 0.862 |
| KRW-BTC | 최근 | 스트레스 | score | 12 | 0.017% | 1.397% | 1.012 |
| KRW-BTC | 최근 | 스트레스 | research_persistence | 9 | 0.174% | 0.832% | 1.170 |
| KRW-BTC | 최근 | 스트레스 | research_slopeMonth | 5 | 0.093% | 0.378% | 1.174 |
| KRW-BTC | 최근 | 스트레스 | research_aboveMonth | 8 | 0.500% | 0.507% | 1.715 |
| KRW-BTC | 최근 | 스트레스 | research_alignedMonth | 4 | -0.437% | 0.554% | 0.124 |
| KRW-ETH | 초기 | 기본 | score | 27 | -0.692% | 4.449% | 0.883 |
| KRW-ETH | 초기 | 기본 | research_persistence | 18 | 0.490% | 2.671% | 1.125 |
| KRW-ETH | 초기 | 기본 | research_slopeMonth | 10 | 0.579% | 1.989% | 1.305 |
| KRW-ETH | 초기 | 기본 | research_aboveMonth | 14 | 1.320% | 1.030% | 1.596 |
| KRW-ETH | 초기 | 기본 | research_alignedMonth | 11 | 0.098% | 1.243% | 1.040 |
| KRW-ETH | 초기 | 스트레스 | score | 27 | -1.837% | 4.995% | 0.732 |
| KRW-ETH | 초기 | 스트레스 | research_persistence | 18 | -0.368% | 3.063% | 0.916 |
| KRW-ETH | 초기 | 스트레스 | research_slopeMonth | 10 | 0.125% | 2.234% | 1.056 |
| KRW-ETH | 초기 | 스트레스 | research_aboveMonth | 14 | 0.655% | 1.279% | 1.256 |
| KRW-ETH | 초기 | 스트레스 | research_alignedMonth | 11 | -0.405% | 1.492% | 0.855 |
| KRW-ETH | 중기 | 기본 | score | 23 | 2.200% | 1.806% | 1.466 |
| KRW-ETH | 중기 | 기본 | research_persistence | 18 | 2.814% | 1.365% | 1.945 |
| KRW-ETH | 중기 | 기본 | research_slopeMonth | 15 | 1.794% | 1.517% | 1.633 |
| KRW-ETH | 중기 | 기본 | research_aboveMonth | 16 | 3.250% | 1.365% | 2.397 |
| KRW-ETH | 중기 | 기본 | research_alignedMonth | 13 | 3.062% | 1.283% | 2.499 |
| KRW-ETH | 중기 | 스트레스 | score | 22 | 1.579% | 2.094% | 1.317 |
| KRW-ETH | 중기 | 스트레스 | research_persistence | 18 | 1.940% | 1.541% | 1.557 |
| KRW-ETH | 중기 | 스트레스 | research_slopeMonth | 15 | 1.079% | 1.708% | 1.328 |
| KRW-ETH | 중기 | 스트레스 | research_aboveMonth | 16 | 2.475% | 1.541% | 1.904 |
| KRW-ETH | 중기 | 스트레스 | research_alignedMonth | 13 | 2.434% | 1.418% | 2.022 |
| KRW-ETH | 최근 | 기본 | score | 12 | -0.721% | 1.687% | 0.607 |
| KRW-ETH | 최근 | 기본 | research_persistence | 7 | 0.796% | 0.613% | 2.183 |
| KRW-ETH | 최근 | 기본 | research_slopeMonth | 5 | 0.435% | 0.572% | 1.959 |
| KRW-ETH | 최근 | 기본 | research_aboveMonth | 6 | 1.042% | 0.543% | 3.437 |
| KRW-ETH | 최근 | 기본 | research_alignedMonth | 5 | -0.505% | 1.096% | 0.471 |
| KRW-ETH | 최근 | 스트레스 | score | 12 | -1.327% | 2.079% | 0.424 |
| KRW-ETH | 최근 | 스트레스 | research_persistence | 7 | 0.436% | 0.765% | 1.498 |
| KRW-ETH | 최근 | 스트레스 | research_slopeMonth | 5 | 0.179% | 0.570% | 1.294 |
| KRW-ETH | 최근 | 스트레스 | research_aboveMonth | 6 | 0.733% | 0.644% | 2.261 |
| KRW-ETH | 최근 | 스트레스 | research_alignedMonth | 5 | -0.757% | 1.241% | 0.343 |
| KRW-XRP | 초기 | 기본 | score | 32 | 2.844% | 4.907% | 1.265 |
| KRW-XRP | 초기 | 기본 | research_persistence | 17 | 7.988% | 2.494% | 2.796 |
| KRW-XRP | 초기 | 기본 | research_slopeMonth | 11 | 9.275% | 2.107% | 4.234 |
| KRW-XRP | 초기 | 기본 | research_aboveMonth | 14 | 8.498% | 2.122% | 3.158 |
| KRW-XRP | 초기 | 기본 | research_alignedMonth | 7 | 8.604% | 2.120% | 5.316 |
| KRW-XRP | 초기 | 스트레스 | score | 31 | 1.090% | 6.038% | 1.097 |
| KRW-XRP | 초기 | 스트레스 | research_persistence | 16 | 6.920% | 3.228% | 2.591 |
| KRW-XRP | 초기 | 스트레스 | research_slopeMonth | 11 | 8.119% | 2.291% | 3.768 |
| KRW-XRP | 초기 | 스트레스 | research_aboveMonth | 13 | 7.583% | 2.566% | 3.056 |
| KRW-XRP | 초기 | 스트레스 | research_alignedMonth | 7 | 8.223% | 2.116% | 4.863 |
| KRW-XRP | 중기 | 기본 | score | 20 | 1.255% | 1.197% | 1.269 |
| KRW-XRP | 중기 | 기본 | research_persistence | 15 | 3.152% | 0.941% | 2.158 |
| KRW-XRP | 중기 | 기본 | research_slopeMonth | 9 | 2.111% | 0.938% | 2.151 |
| KRW-XRP | 중기 | 기본 | research_aboveMonth | 14 | 2.695% | 0.941% | 1.990 |
| KRW-XRP | 중기 | 기본 | research_alignedMonth | 5 | 2.437% | 0.742% | 5.196 |
| KRW-XRP | 중기 | 스트레스 | score | 18 | 0.169% | 1.391% | 1.034 |
| KRW-XRP | 중기 | 스트레스 | research_persistence | 15 | 1.963% | 1.031% | 1.596 |
| KRW-XRP | 중기 | 스트레스 | research_slopeMonth | 9 | 1.655% | 1.027% | 1.798 |
| KRW-XRP | 중기 | 스트레스 | research_aboveMonth | 14 | 1.994% | 1.031% | 1.643 |
| KRW-XRP | 중기 | 스트레스 | research_alignedMonth | 5 | 2.173% | 0.838% | 4.188 |
| KRW-XRP | 최근 | 기본 | score | 16 | 0.074% | 1.981% | 1.022 |
| KRW-XRP | 최근 | 기본 | research_persistence | 7 | 1.753% | 0.746% | 3.027 |
| KRW-XRP | 최근 | 기본 | research_slopeMonth | 4 | -0.043% | 1.233% | 0.949 |
| KRW-XRP | 최근 | 기본 | research_aboveMonth | 6 | 2.043% | 0.731% | 4.552 |
| KRW-XRP | 최근 | 기본 | research_alignedMonth | 2 | -0.678% | 0.678% | 0.000 |
| KRW-XRP | 최근 | 스트레스 | score | 16 | -0.652% | 2.217% | 0.838 |
| KRW-XRP | 최근 | 스트레스 | research_persistence | 8 | 0.981% | 1.332% | 1.653 |
| KRW-XRP | 최근 | 스트레스 | research_slopeMonth | 4 | -0.219% | 1.285% | 0.776 |
| KRW-XRP | 최근 | 스트레스 | research_aboveMonth | 7 | 1.321% | 0.991% | 2.138 |
| KRW-XRP | 최근 | 스트레스 | research_alignedMonth | 2 | -0.773% | 0.773% | 0.000 |

## 지속 신호 대비 차이

| 후보 | 종목 | 구간 | 차이(%p) |
|---|---|---|---:|
| research_slopeMonth | KRW-BTC | 중기 | 0.609 |
| research_slopeMonth | KRW-BTC | 최근 | -0.559 |
| research_slopeMonth | KRW-ETH | 중기 | -1.020 |
| research_slopeMonth | KRW-ETH | 최근 | -0.361 |
| research_slopeMonth | KRW-XRP | 중기 | -1.041 |
| research_slopeMonth | KRW-XRP | 최근 | -1.796 |
| research_aboveMonth | KRW-BTC | 중기 | 0.311 |
| research_aboveMonth | KRW-BTC | 최근 | 0.000 |
| research_aboveMonth | KRW-ETH | 중기 | 0.435 |
| research_aboveMonth | KRW-ETH | 최근 | 0.246 |
| research_aboveMonth | KRW-XRP | 중기 | -0.458 |
| research_aboveMonth | KRW-XRP | 최근 | 0.290 |
| research_alignedMonth | KRW-BTC | 중기 | 0.380 |
| research_alignedMonth | KRW-BTC | 최근 | -1.141 |
| research_alignedMonth | KRW-ETH | 중기 | 0.248 |
| research_alignedMonth | KRW-ETH | 최근 | -1.301 |
| research_alignedMonth | KRW-XRP | 중기 | -0.715 |
| research_alignedMonth | KRW-XRP | 최근 | -2.431 |

재현: node scripts/research-long-trend.mjs --replay. 원본 logs/T023-results.json. 운영 미배포.
