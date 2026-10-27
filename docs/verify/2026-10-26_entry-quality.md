> 2026-10-27 T026 재계산: 보유기간 계산을 실제 경로에 맞춰 수정했다. [감사 기록](2026-10-27_execution-parity.md). 수정 전 자료는 logs/T026-before-parity/에 보존.

# 진입 품질 연구 · 2026-10-26

T022 사전 고정3가설/2비교군·90개 비교. T018 시세 재사용/3연속구간/준비200봉. 별도1천만원 계좌·매수100만원 상한, 최초손절/청산 동일. 기본 편도 비용0.04%+슬리피지0.05%, 스트레스0.25%+0.10%(계정 요율 가정). 구간별 현금 재시작/끝 청산, 공백 보간 없음. 단일진입 백테스트 일일/누적손실 차단 미적용 제한 유지.

이미 본 데이터의 후속 탐색이며 독립 검증이 아니다. 후반 두 기간 모든 종목 양수·score 초과, 평균MDD/스트레스/거래수 조건을 동시에 요구한다. 상세 가설과 판정은 docs/tasks/T-022-entry-quality.md.

- research_extension: **탈락**. 중기: 기존 대비 평균 수익률 개선 부족 / 중기: 수익 종목 2개 미만 / 최근: 비용 스트레스 평균 수익률 비양수 / 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족 / 중기/KRW-ETH: 양수·기존 초과 동시 미충족 / 최근/KRW-XRP: 양수·기존 초과 동시 미충족
- research_closeStrength: **탈락**. 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족
- research_acceleration: **탈락**. 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족

| 종목 | 구간 | 비용 | 전략 | 거래 | 수익률 | MDD | PF |
|---|---|---|---|---:|---:|---:|---:|
| KRW-BTC | 초기 | 기본 | score | 27 | 3.363% | 1.053% | 2.384 |
| KRW-BTC | 초기 | 기본 | research_persistence | 21 | 3.138% | 0.907% | 2.365 |
| KRW-BTC | 초기 | 기본 | research_extension | 11 | -0.036% | 1.054% | 0.974 |
| KRW-BTC | 초기 | 기본 | research_closeStrength | 19 | 3.079% | 0.907% | 2.345 |
| KRW-BTC | 초기 | 기본 | research_acceleration | 15 | 3.642% | 0.973% | 4.142 |
| KRW-BTC | 초기 | 스트레스 | score | 28 | 0.983% | 1.130% | 1.252 |
| KRW-BTC | 초기 | 스트레스 | research_persistence | 21 | 1.469% | 1.155% | 1.475 |
| KRW-BTC | 초기 | 스트레스 | research_extension | 13 | -1.391% | 2.155% | 0.466 |
| KRW-BTC | 초기 | 스트레스 | research_closeStrength | 19 | 1.471% | 1.155% | 1.487 |
| KRW-BTC | 초기 | 스트레스 | research_acceleration | 15 | 2.892% | 1.015% | 2.995 |
| KRW-BTC | 중기 | 기본 | score | 24 | -0.641% | 1.166% | 0.803 |
| KRW-BTC | 중기 | 기본 | research_persistence | 16 | -0.474% | 1.048% | 0.776 |
| KRW-BTC | 중기 | 기본 | research_extension | 7 | -0.160% | 0.539% | 0.808 |
| KRW-BTC | 중기 | 기본 | research_closeStrength | 12 | -0.973% | 1.495% | 0.439 |
| KRW-BTC | 중기 | 기본 | research_acceleration | 11 | -0.720% | 1.288% | 0.586 |
| KRW-BTC | 중기 | 스트레스 | score | 25 | -2.041% | 2.170% | 0.521 |
| KRW-BTC | 중기 | 스트레스 | research_persistence | 16 | -1.249% | 1.299% | 0.533 |
| KRW-BTC | 중기 | 스트레스 | research_extension | 7 | -0.486% | 0.692% | 0.553 |
| KRW-BTC | 중기 | 스트레스 | research_closeStrength | 12 | -1.552% | 1.730% | 0.296 |
| KRW-BTC | 중기 | 스트레스 | research_acceleration | 11 | -1.246% | 1.520% | 0.408 |
| KRW-BTC | 최근 | 기본 | score | 11 | 1.055% | 0.631% | 2.454 |
| KRW-BTC | 최근 | 기본 | research_persistence | 9 | 1.099% | 0.288% | 3.407 |
| KRW-BTC | 최근 | 기본 | research_extension | 6 | 0.697% | 0.189% | 7.203 |
| KRW-BTC | 최근 | 기본 | research_closeStrength | 6 | 0.027% | 0.453% | 1.038 |
| KRW-BTC | 최근 | 기본 | research_acceleration | 6 | -0.264% | 0.537% | 0.738 |
| KRW-BTC | 최근 | 스트레스 | score | 12 | 0.017% | 1.397% | 1.012 |
| KRW-BTC | 최근 | 스트레스 | research_persistence | 9 | 0.174% | 0.832% | 1.170 |
| KRW-BTC | 최근 | 스트레스 | research_extension | 5 | 0.246% | 0.396% | 1.953 |
| KRW-BTC | 최근 | 스트레스 | research_closeStrength | 6 | -0.274% | 0.579% | 0.717 |
| KRW-BTC | 최근 | 스트레스 | research_acceleration | 7 | -0.880% | 0.940% | 0.441 |
| KRW-ETH | 초기 | 기본 | score | 27 | -0.692% | 4.449% | 0.883 |
| KRW-ETH | 초기 | 기본 | research_persistence | 18 | 0.490% | 2.671% | 1.125 |
| KRW-ETH | 초기 | 기본 | research_extension | 10 | -1.306% | 2.295% | 0.456 |
| KRW-ETH | 초기 | 기본 | research_closeStrength | 14 | 2.105% | 0.985% | 2.041 |
| KRW-ETH | 초기 | 기본 | research_acceleration | 12 | -0.577% | 1.821% | 0.822 |
| KRW-ETH | 초기 | 스트레스 | score | 27 | -1.837% | 4.995% | 0.732 |
| KRW-ETH | 초기 | 스트레스 | research_persistence | 18 | -0.368% | 3.063% | 0.916 |
| KRW-ETH | 초기 | 스트레스 | research_extension | 10 | -1.762% | 2.595% | 0.359 |
| KRW-ETH | 초기 | 스트레스 | research_closeStrength | 14 | 1.395% | 1.134% | 1.604 |
| KRW-ETH | 초기 | 스트레스 | research_acceleration | 12 | -1.171% | 1.958% | 0.677 |
| KRW-ETH | 중기 | 기본 | score | 23 | 2.200% | 1.806% | 1.466 |
| KRW-ETH | 중기 | 기본 | research_persistence | 18 | 2.814% | 1.365% | 1.945 |
| KRW-ETH | 중기 | 기본 | research_extension | 7 | -0.465% | 1.163% | 0.631 |
| KRW-ETH | 중기 | 기본 | research_closeStrength | 13 | 2.926% | 1.012% | 2.867 |
| KRW-ETH | 중기 | 기본 | research_acceleration | 12 | 4.086% | 0.787% | 4.320 |
| KRW-ETH | 중기 | 스트레스 | score | 22 | 1.579% | 2.094% | 1.317 |
| KRW-ETH | 중기 | 스트레스 | research_persistence | 18 | 1.940% | 1.541% | 1.557 |
| KRW-ETH | 중기 | 스트레스 | research_extension | 8 | -1.211% | 1.831% | 0.383 |
| KRW-ETH | 중기 | 스트레스 | research_closeStrength | 13 | 2.264% | 1.107% | 2.207 |
| KRW-ETH | 중기 | 스트레스 | research_acceleration | 12 | 3.472% | 0.873% | 3.356 |
| KRW-ETH | 최근 | 기본 | score | 12 | -0.721% | 1.687% | 0.607 |
| KRW-ETH | 최근 | 기본 | research_persistence | 7 | 0.796% | 0.613% | 2.183 |
| KRW-ETH | 최근 | 기본 | research_extension | 4 | 0.426% | 0.563% | 2.042 |
| KRW-ETH | 최근 | 기본 | research_closeStrength | 3 | 0.690% | 0.634% | 2.941 |
| KRW-ETH | 최근 | 기본 | research_acceleration | 3 | 0.085% | 0.470% | 1.155 |
| KRW-ETH | 최근 | 스트레스 | score | 12 | -1.327% | 2.079% | 0.424 |
| KRW-ETH | 최근 | 스트레스 | research_persistence | 7 | 0.436% | 0.765% | 1.498 |
| KRW-ETH | 최근 | 스트레스 | research_extension | 4 | 0.221% | 0.664% | 1.433 |
| KRW-ETH | 최근 | 스트레스 | research_closeStrength | 2 | 0.177% | 0.686% | 1.437 |
| KRW-ETH | 최근 | 스트레스 | research_acceleration | 3 | -0.063% | 0.533% | 0.902 |
| KRW-XRP | 초기 | 기본 | score | 32 | 2.844% | 4.907% | 1.265 |
| KRW-XRP | 초기 | 기본 | research_persistence | 17 | 7.988% | 2.494% | 2.796 |
| KRW-XRP | 초기 | 기본 | research_extension | 12 | 1.650% | 1.492% | 1.713 |
| KRW-XRP | 초기 | 기본 | research_closeStrength | 10 | 9.263% | 2.206% | 5.726 |
| KRW-XRP | 초기 | 기본 | research_acceleration | 10 | 7.840% | 2.221% | 4.210 |
| KRW-XRP | 초기 | 스트레스 | score | 31 | 1.090% | 6.038% | 1.097 |
| KRW-XRP | 초기 | 스트레스 | research_persistence | 16 | 6.920% | 3.228% | 2.591 |
| KRW-XRP | 초기 | 스트레스 | research_extension | 12 | 0.251% | 2.794% | 1.091 |
| KRW-XRP | 초기 | 스트레스 | research_closeStrength | 9 | 8.897% | 2.282% | 5.386 |
| KRW-XRP | 초기 | 스트레스 | research_acceleration | 10 | 7.313% | 2.263% | 3.735 |
| KRW-XRP | 중기 | 기본 | score | 20 | 1.255% | 1.197% | 1.269 |
| KRW-XRP | 중기 | 기본 | research_persistence | 15 | 3.152% | 0.941% | 2.158 |
| KRW-XRP | 중기 | 기본 | research_extension | 5 | 2.914% | 0.343% | 15.237 |
| KRW-XRP | 중기 | 기본 | research_closeStrength | 13 | 2.478% | 0.946% | 1.985 |
| KRW-XRP | 중기 | 기본 | research_acceleration | 11 | 3.229% | 0.946% | 2.829 |
| KRW-XRP | 중기 | 스트레스 | score | 18 | 0.169% | 1.391% | 1.034 |
| KRW-XRP | 중기 | 스트레스 | research_persistence | 15 | 1.963% | 1.031% | 1.596 |
| KRW-XRP | 중기 | 스트레스 | research_extension | 6 | 2.683% | 0.373% | 11.709 |
| KRW-XRP | 중기 | 스트레스 | research_closeStrength | 13 | 1.826% | 1.036% | 1.640 |
| KRW-XRP | 중기 | 스트레스 | research_acceleration | 11 | 2.677% | 1.036% | 2.338 |
| KRW-XRP | 최근 | 기본 | score | 16 | 0.074% | 1.981% | 1.022 |
| KRW-XRP | 최근 | 기본 | research_persistence | 7 | 1.753% | 0.746% | 3.027 |
| KRW-XRP | 최근 | 기본 | research_extension | 4 | -0.701% | 0.701% | 0.000 |
| KRW-XRP | 최근 | 기본 | research_closeStrength | 5 | 2.076% | 0.543% | 4.826 |
| KRW-XRP | 최근 | 기본 | research_acceleration | 4 | 2.236% | 0.468% | 6.852 |
| KRW-XRP | 최근 | 스트레스 | score | 16 | -0.652% | 2.217% | 0.838 |
| KRW-XRP | 최근 | 스트레스 | research_persistence | 8 | 0.981% | 1.332% | 1.653 |
| KRW-XRP | 최근 | 스트레스 | research_extension | 4 | -0.895% | 0.895% | 0.000 |
| KRW-XRP | 최근 | 스트레스 | research_closeStrength | 6 | 1.355% | 1.128% | 2.200 |
| KRW-XRP | 최근 | 스트레스 | research_acceleration | 5 | 1.663% | 0.820% | 3.028 |

## 지속 신호 대비 차이

| 후보 | 종목 | 구간 | 차이(%p) |
|---|---|---|---:|
| research_extension | KRW-BTC | 중기 | 0.314 |
| research_extension | KRW-BTC | 최근 | -0.402 |
| research_extension | KRW-ETH | 중기 | -3.280 |
| research_extension | KRW-ETH | 최근 | -0.370 |
| research_extension | KRW-XRP | 중기 | -0.238 |
| research_extension | KRW-XRP | 최근 | -2.455 |
| research_closeStrength | KRW-BTC | 중기 | -0.500 |
| research_closeStrength | KRW-BTC | 최근 | -1.072 |
| research_closeStrength | KRW-ETH | 중기 | 0.112 |
| research_closeStrength | KRW-ETH | 최근 | -0.107 |
| research_closeStrength | KRW-XRP | 중기 | -0.674 |
| research_closeStrength | KRW-XRP | 최근 | 0.323 |
| research_acceleration | KRW-BTC | 중기 | -0.246 |
| research_acceleration | KRW-BTC | 최근 | -1.363 |
| research_acceleration | KRW-ETH | 중기 | 1.271 |
| research_acceleration | KRW-ETH | 최근 | -0.711 |
| research_acceleration | KRW-XRP | 중기 | 0.077 |
| research_acceleration | KRW-XRP | 최근 | 0.483 |

재현: node scripts/research-entry-quality.mjs --replay. 원본 logs/T022-results.json. 운영 미배포.
