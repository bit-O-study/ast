> 2026-10-27 T026 재계산: 보유기간 계산을 실제 경로에 맞춰 수정했다. [감사 기록](2026-10-27_execution-parity.md). 수정 전 자료는 logs/T026-before-parity/에 보존.

# 진입 지속성 연구 · 2026-10-26

T020 사전 고정3가설·72개 비교. T018의 이미 관찰한 시세를 재사용한 탐색이며 독립 검증이 아니다. 종목별 별도1천만원 계좌/매수100만원 상한, 동일 공통 청산. 각 구간200봉 준비 후 현금으로 시작하고 끝에서 청산한다. 공백 보간 없음. 단일진입 백테스트 일일/누적손실 차단 미적용이라는 기존 제한도 유지된다.

기본 비용은 편도 수수료0.04%+슬리피지0.05%, 스트레스0.25%+0.10%. 계정 요율 가정. 수익률은 계좌 대비다. 기존 평균 기준에 추가해 후반 두 구간에서 모든 종목이 양수이며 기존 초과여야 통과한다.

- research_longTrend: **탈락**. 최근: 기존 대비 평균 수익률 개선 부족 / 최근: 비용 스트레스 평균 수익률 비양수 / 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 중기/KRW-ETH: 양수·기존 초과 동시 미충족 / 최근/KRW-XRP: 양수·기존 초과 동시 미충족
- research_efficiency: **탈락**. 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족
- research_persistence: **탈락**. 중기/KRW-BTC: 양수·기존 초과 동시 미충족

| 종목 | 구간 | 비용 | 후보 | 거래수 | 수익률 | MDD | PF |
|---|---|---|---|---:|---:|---:|---:|
| KRW-BTC | 초기 | 기본 | score | 27 | 3.363% | 1.053% | 2.384 |
| KRW-BTC | 초기 | 기본 | research_longTrend | 24 | 3.427% | 0.920% | 2.604 |
| KRW-BTC | 초기 | 기본 | research_efficiency | 21 | 3.473% | 1.053% | 2.729 |
| KRW-BTC | 초기 | 기본 | research_persistence | 21 | 3.138% | 0.907% | 2.365 |
| KRW-BTC | 초기 | 스트레스 | score | 28 | 0.983% | 1.130% | 1.252 |
| KRW-BTC | 초기 | 스트레스 | research_longTrend | 25 | 1.272% | 1.092% | 1.357 |
| KRW-BTC | 초기 | 스트레스 | research_efficiency | 22 | 1.395% | 1.335% | 1.459 |
| KRW-BTC | 초기 | 스트레스 | research_persistence | 21 | 1.469% | 1.155% | 1.475 |
| KRW-BTC | 중기 | 기본 | score | 24 | -0.641% | 1.166% | 0.803 |
| KRW-BTC | 중기 | 기본 | research_longTrend | 19 | -0.517% | 1.102% | 0.781 |
| KRW-BTC | 중기 | 기본 | research_efficiency | 18 | -0.292% | 1.009% | 0.870 |
| KRW-BTC | 중기 | 기본 | research_persistence | 16 | -0.474% | 1.048% | 0.776 |
| KRW-BTC | 중기 | 스트레스 | score | 25 | -2.041% | 2.170% | 0.521 |
| KRW-BTC | 중기 | 스트레스 | research_longTrend | 20 | -1.677% | 1.901% | 0.480 |
| KRW-BTC | 중기 | 스트레스 | research_efficiency | 19 | -1.367% | 1.602% | 0.541 |
| KRW-BTC | 중기 | 스트레스 | research_persistence | 16 | -1.249% | 1.299% | 0.533 |
| KRW-BTC | 최근 | 기본 | score | 11 | 1.055% | 0.631% | 2.454 |
| KRW-BTC | 최근 | 기본 | research_longTrend | 9 | 1.302% | 0.339% | 3.718 |
| KRW-BTC | 최근 | 기본 | research_efficiency | 7 | 1.040% | 0.475% | 3.162 |
| KRW-BTC | 최근 | 기본 | research_persistence | 9 | 1.099% | 0.288% | 3.407 |
| KRW-BTC | 최근 | 스트레스 | score | 12 | 0.017% | 1.397% | 1.012 |
| KRW-BTC | 최근 | 스트레스 | research_longTrend | 9 | 0.692% | 0.723% | 1.959 |
| KRW-BTC | 최근 | 스트레스 | research_efficiency | 8 | 0.184% | 1.050% | 1.175 |
| KRW-BTC | 최근 | 스트레스 | research_persistence | 9 | 0.174% | 0.832% | 1.170 |
| KRW-ETH | 초기 | 기본 | score | 27 | -0.692% | 4.449% | 0.883 |
| KRW-ETH | 초기 | 기본 | research_longTrend | 17 | -0.028% | 2.316% | 0.992 |
| KRW-ETH | 초기 | 기본 | research_efficiency | 19 | -0.044% | 2.417% | 0.989 |
| KRW-ETH | 초기 | 기본 | research_persistence | 18 | 0.490% | 2.671% | 1.125 |
| KRW-ETH | 초기 | 스트레스 | score | 27 | -1.837% | 4.995% | 0.732 |
| KRW-ETH | 초기 | 스트레스 | research_longTrend | 17 | -0.780% | 2.620% | 0.800 |
| KRW-ETH | 초기 | 스트레스 | research_efficiency | 19 | -0.828% | 2.672% | 0.827 |
| KRW-ETH | 초기 | 스트레스 | research_persistence | 18 | -0.368% | 3.063% | 0.916 |
| KRW-ETH | 중기 | 기본 | score | 23 | 2.200% | 1.806% | 1.466 |
| KRW-ETH | 중기 | 기본 | research_longTrend | 17 | 2.193% | 2.150% | 1.624 |
| KRW-ETH | 중기 | 기본 | research_efficiency | 15 | 4.217% | 1.117% | 2.771 |
| KRW-ETH | 중기 | 기본 | research_persistence | 18 | 2.814% | 1.365% | 1.945 |
| KRW-ETH | 중기 | 스트레스 | score | 22 | 1.579% | 2.094% | 1.317 |
| KRW-ETH | 중기 | 스트레스 | research_longTrend | 16 | 1.903% | 2.462% | 1.534 |
| KRW-ETH | 중기 | 스트레스 | research_efficiency | 15 | 3.756% | 1.257% | 2.510 |
| KRW-ETH | 중기 | 스트레스 | research_persistence | 18 | 1.940% | 1.541% | 1.557 |
| KRW-ETH | 최근 | 기본 | score | 12 | -0.721% | 1.687% | 0.607 |
| KRW-ETH | 최근 | 기본 | research_longTrend | 9 | 0.160% | 1.029% | 1.168 |
| KRW-ETH | 최근 | 기본 | research_efficiency | 7 | 0.209% | 1.038% | 1.232 |
| KRW-ETH | 최근 | 기본 | research_persistence | 7 | 0.796% | 0.613% | 2.183 |
| KRW-ETH | 최근 | 스트레스 | score | 12 | -1.327% | 2.079% | 0.424 |
| KRW-ETH | 최근 | 스트레스 | research_longTrend | 9 | -0.300% | 1.226% | 0.765 |
| KRW-ETH | 최근 | 스트레스 | research_efficiency | 7 | -0.138% | 1.225% | 0.877 |
| KRW-ETH | 최근 | 스트레스 | research_persistence | 7 | 0.436% | 0.765% | 1.498 |
| KRW-XRP | 초기 | 기본 | score | 32 | 2.844% | 4.907% | 1.265 |
| KRW-XRP | 초기 | 기본 | research_longTrend | 22 | 4.331% | 3.451% | 1.501 |
| KRW-XRP | 초기 | 기본 | research_efficiency | 19 | 6.124% | 2.681% | 1.883 |
| KRW-XRP | 초기 | 기본 | research_persistence | 17 | 7.988% | 2.494% | 2.796 |
| KRW-XRP | 초기 | 스트레스 | score | 31 | 1.090% | 6.038% | 1.097 |
| KRW-XRP | 초기 | 스트레스 | research_longTrend | 21 | 3.055% | 4.187% | 1.349 |
| KRW-XRP | 초기 | 스트레스 | research_efficiency | 19 | 4.605% | 3.732% | 1.632 |
| KRW-XRP | 초기 | 스트레스 | research_persistence | 16 | 6.920% | 3.228% | 2.591 |
| KRW-XRP | 중기 | 기본 | score | 20 | 1.255% | 1.197% | 1.269 |
| KRW-XRP | 중기 | 기본 | research_longTrend | 13 | 2.326% | 1.169% | 1.841 |
| KRW-XRP | 중기 | 기본 | research_efficiency | 13 | 2.666% | 1.005% | 2.178 |
| KRW-XRP | 중기 | 기본 | research_persistence | 15 | 3.152% | 0.941% | 2.158 |
| KRW-XRP | 중기 | 스트레스 | score | 18 | 0.169% | 1.391% | 1.034 |
| KRW-XRP | 중기 | 스트레스 | research_longTrend | 13 | 1.667% | 1.317% | 1.537 |
| KRW-XRP | 중기 | 스트레스 | research_efficiency | 13 | 2.018% | 1.237% | 1.778 |
| KRW-XRP | 중기 | 스트레스 | research_persistence | 15 | 1.963% | 1.031% | 1.596 |
| KRW-XRP | 최근 | 기본 | score | 16 | 0.074% | 1.981% | 1.022 |
| KRW-XRP | 최근 | 기본 | research_longTrend | 12 | -1.660% | 2.099% | 0.462 |
| KRW-XRP | 최근 | 기본 | research_efficiency | 8 | 0.838% | 1.128% | 1.457 |
| KRW-XRP | 최근 | 기본 | research_persistence | 7 | 1.753% | 0.746% | 3.027 |
| KRW-XRP | 최근 | 스트레스 | score | 16 | -0.652% | 2.217% | 0.838 |
| KRW-XRP | 최근 | 스트레스 | research_longTrend | 12 | -2.103% | 2.330% | 0.390 |
| KRW-XRP | 최근 | 스트레스 | research_efficiency | 8 | 0.646% | 1.211% | 1.341 |
| KRW-XRP | 최근 | 스트레스 | research_persistence | 8 | 0.981% | 1.332% | 1.653 |

재현: node scripts/research-entry-filters.mjs. 조건: docs/tasks/T-020-entry-persistence.md. 전체 수치: logs/T020-results.json. 운영 배포 없음.
