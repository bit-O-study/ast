> 2026-10-27 T026 재계산: 보유기간 계산을 실제 경로에 맞춰 수정했다. [감사 기록](2026-10-27_execution-parity.md). 수정 전 자료는 logs/T026-before-parity/에 보존.

# 순차 기대수익 연구 · 2026-10-26

T025 사전 고정3후보/2비교군·90개 비교. T018 고정시세/3연속구간/준비200봉. 별도1천만원 계좌·매수100만원 상한, 최초손절/청산 동일. 기본 편도 비용0.04%+슬리피지0.05%, 스트레스0.25%+0.10%(계정 요율 가정). 구간별 현금 재시작/끝 청산, 공백 보간 없음. 단일진입 백테스트 일일/누적손실 차단 미적용 제한 유지.

이미 관찰한 데이터의 후속 탐색이며 독립 검증이 아니다. 후반 두 기간 전종목 양수·score 초과/평균MDD/스트레스/30거래 기준을 모두 요구한다. 상세 명세: docs/tasks/T-025-rolling-forecast.md.

- research_forecast6: **탈락**. 최근: 기존 대비 평균 수익률 개선 부족 / 최근: 비용 스트레스 평균 수익률 비양수 / 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-XRP: 양수·기존 초과 동시 미충족
- research_forecast18: **탈락**. 최근: 기존 대비 평균 수익률 개선 부족 / 최근: 수익 종목 2개 미만 / 최근: 비용 스트레스 평균 수익률 비양수 / 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-ETH: 양수·기존 초과 동시 미충족 / 최근/KRW-XRP: 양수·기존 초과 동시 미충족
- research_forecast42: **탈락**. 중기: 기존 대비 평균 수익률 개선 부족 / 최근: 기존 대비 평균 수익률 개선 부족 / 최근: 수익 종목 2개 미만 / 최근: 비용 스트레스 평균 수익률 비양수 / 후반 거래 28건: 최소 30건 미달 / 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족 / 중기/KRW-ETH: 양수·기존 초과 동시 미충족 / 최근/KRW-ETH: 양수·기존 초과 동시 미충족 / 최근/KRW-XRP: 양수·기존 초과 동시 미충족

| 종목 | 구간 | 비용 | 후보 | 거래 | 수익률 | MDD | PF |
|---|---|---|---|---:|---:|---:|---:|
| KRW-BTC | 초기 | 기본 | score | 27 | 3.363% | 1.053% | 2.384 |
| KRW-BTC | 초기 | 기본 | research_persistence | 21 | 3.138% | 0.907% | 2.365 |
| KRW-BTC | 초기 | 기본 | research_forecast6 | 17 | 0.692% | 1.638% | 1.282 |
| KRW-BTC | 초기 | 기본 | research_forecast18 | 16 | -0.325% | 1.665% | 0.864 |
| KRW-BTC | 초기 | 기본 | research_forecast42 | 12 | 0.824% | 0.856% | 1.506 |
| KRW-BTC | 초기 | 스트레스 | score | 28 | 0.983% | 1.130% | 1.252 |
| KRW-BTC | 초기 | 스트레스 | research_persistence | 21 | 1.469% | 1.155% | 1.475 |
| KRW-BTC | 초기 | 스트레스 | research_forecast6 | 15 | -1.186% | 1.832% | 0.640 |
| KRW-BTC | 초기 | 스트레스 | research_forecast18 | 12 | 0.133% | 0.831% | 1.080 |
| KRW-BTC | 초기 | 스트레스 | research_forecast42 | 12 | -0.630% | 1.678% | 0.739 |
| KRW-BTC | 중기 | 기본 | score | 24 | -0.641% | 1.166% | 0.803 |
| KRW-BTC | 중기 | 기본 | research_persistence | 16 | -0.474% | 1.048% | 0.776 |
| KRW-BTC | 중기 | 기본 | research_forecast6 | 10 | -1.184% | 1.287% | 0.281 |
| KRW-BTC | 중기 | 기본 | research_forecast18 | 11 | -1.460% | 1.593% | 0.250 |
| KRW-BTC | 중기 | 기본 | research_forecast42 | 8 | -0.678% | 0.781% | 0.392 |
| KRW-BTC | 중기 | 스트레스 | score | 25 | -2.041% | 2.170% | 0.521 |
| KRW-BTC | 중기 | 스트레스 | research_persistence | 16 | -1.249% | 1.299% | 0.533 |
| KRW-BTC | 중기 | 스트레스 | research_forecast6 | 8 | -1.645% | 1.650% | 0.129 |
| KRW-BTC | 중기 | 스트레스 | research_forecast18 | 11 | -2.891% | 2.895% | 0.000 |
| KRW-BTC | 중기 | 스트레스 | research_forecast42 | 8 | -1.080% | 1.084% | 0.264 |
| KRW-BTC | 최근 | 기본 | score | 11 | 1.055% | 0.631% | 2.454 |
| KRW-BTC | 최근 | 기본 | research_persistence | 9 | 1.099% | 0.288% | 3.407 |
| KRW-BTC | 최근 | 기본 | research_forecast6 | 4 | 0.458% | 0.507% | 2.090 |
| KRW-BTC | 최근 | 기본 | research_forecast18 | 3 | -0.337% | 0.429% | 0.198 |
| KRW-BTC | 최근 | 기본 | research_forecast42 | 3 | 0.265% | 0.106% | ∞ |
| KRW-BTC | 최근 | 스트레스 | score | 12 | 0.017% | 1.397% | 1.012 |
| KRW-BTC | 최근 | 스트레스 | research_persistence | 9 | 0.174% | 0.832% | 1.170 |
| KRW-BTC | 최근 | 스트레스 | research_forecast6 | 3 | 0.220% | 0.602% | 1.421 |
| KRW-BTC | 최근 | 스트레스 | research_forecast18 | 4 | -0.785% | 0.902% | 0.073 |
| KRW-BTC | 최근 | 스트레스 | research_forecast42 | 2 | -0.119% | 0.283% | 0.342 |
| KRW-ETH | 초기 | 기본 | score | 27 | -0.692% | 4.449% | 0.883 |
| KRW-ETH | 초기 | 기본 | research_persistence | 18 | 0.490% | 2.671% | 1.125 |
| KRW-ETH | 초기 | 기본 | research_forecast6 | 11 | -0.305% | 1.973% | 0.893 |
| KRW-ETH | 초기 | 기본 | research_forecast18 | 10 | -2.448% | 3.233% | 0.184 |
| KRW-ETH | 초기 | 기본 | research_forecast42 | 11 | -0.015% | 1.461% | 0.994 |
| KRW-ETH | 초기 | 스트레스 | score | 27 | -1.837% | 4.995% | 0.732 |
| KRW-ETH | 초기 | 스트레스 | research_persistence | 18 | -0.368% | 3.063% | 0.916 |
| KRW-ETH | 초기 | 스트레스 | research_forecast6 | 8 | 0.918% | 1.008% | 1.578 |
| KRW-ETH | 초기 | 스트레스 | research_forecast18 | 7 | -1.965% | 2.734% | 0.217 |
| KRW-ETH | 초기 | 스트레스 | research_forecast42 | 11 | -0.513% | 1.682% | 0.826 |
| KRW-ETH | 중기 | 기본 | score | 23 | 2.200% | 1.806% | 1.466 |
| KRW-ETH | 중기 | 기본 | research_persistence | 18 | 2.814% | 1.365% | 1.945 |
| KRW-ETH | 중기 | 기본 | research_forecast6 | 9 | 2.353% | 0.732% | 2.860 |
| KRW-ETH | 중기 | 기본 | research_forecast18 | 10 | 3.755% | 0.727% | 4.872 |
| KRW-ETH | 중기 | 기본 | research_forecast42 | 8 | 0.759% | 1.172% | 1.634 |
| KRW-ETH | 중기 | 스트레스 | score | 22 | 1.579% | 2.094% | 1.317 |
| KRW-ETH | 중기 | 스트레스 | research_persistence | 18 | 1.940% | 1.541% | 1.557 |
| KRW-ETH | 중기 | 스트레스 | research_forecast6 | 8 | 0.956% | 1.124% | 1.569 |
| KRW-ETH | 중기 | 스트레스 | research_forecast18 | 10 | 2.056% | 1.197% | 2.261 |
| KRW-ETH | 중기 | 스트레스 | research_forecast42 | 8 | 0.362% | 1.368% | 1.244 |
| KRW-ETH | 최근 | 기본 | score | 12 | -0.721% | 1.687% | 0.607 |
| KRW-ETH | 최근 | 기본 | research_persistence | 7 | 0.796% | 0.613% | 2.183 |
| KRW-ETH | 최근 | 기본 | research_forecast6 | 4 | 0.032% | 0.573% | 1.067 |
| KRW-ETH | 최근 | 기본 | research_forecast18 | 1 | -0.163% | 0.163% | 0.000 |
| KRW-ETH | 최근 | 기본 | research_forecast42 | 2 | -0.350% | 0.350% | 0.000 |
| KRW-ETH | 최근 | 스트레스 | score | 12 | -1.327% | 2.079% | 0.424 |
| KRW-ETH | 최근 | 스트레스 | research_persistence | 7 | 0.436% | 0.765% | 1.498 |
| KRW-ETH | 최근 | 스트레스 | research_forecast6 | 3 | 0.114% | 0.570% | 1.325 |
| KRW-ETH | 최근 | 스트레스 | research_forecast18 | 1 | -0.214% | 0.214% | 0.000 |
| KRW-ETH | 최근 | 스트레스 | research_forecast42 | 2 | -0.452% | 0.452% | 0.000 |
| KRW-XRP | 초기 | 기본 | score | 32 | 2.844% | 4.907% | 1.265 |
| KRW-XRP | 초기 | 기본 | research_persistence | 17 | 7.988% | 2.494% | 2.796 |
| KRW-XRP | 초기 | 기본 | research_forecast6 | 11 | 9.473% | 2.103% | 4.198 |
| KRW-XRP | 초기 | 기본 | research_forecast18 | 10 | 10.315% | 2.087% | 6.026 |
| KRW-XRP | 초기 | 기본 | research_forecast42 | 6 | 7.905% | 2.111% | 6.087 |
| KRW-XRP | 초기 | 스트레스 | score | 31 | 1.090% | 6.038% | 1.097 |
| KRW-XRP | 초기 | 스트레스 | research_persistence | 16 | 6.920% | 3.228% | 2.591 |
| KRW-XRP | 초기 | 스트레스 | research_forecast6 | 8 | 9.536% | 2.091% | 6.682 |
| KRW-XRP | 초기 | 스트레스 | research_forecast18 | 9 | 9.363% | 2.094% | 5.904 |
| KRW-XRP | 초기 | 스트레스 | research_forecast42 | 6 | 7.573% | 2.107% | 5.463 |
| KRW-XRP | 중기 | 기본 | score | 20 | 1.255% | 1.197% | 1.269 |
| KRW-XRP | 중기 | 기본 | research_persistence | 15 | 3.152% | 0.941% | 2.158 |
| KRW-XRP | 중기 | 기본 | research_forecast6 | 7 | 2.793% | 1.178% | 3.928 |
| KRW-XRP | 중기 | 기본 | research_forecast18 | 5 | 2.792% | 0.868% | 4.702 |
| KRW-XRP | 중기 | 기본 | research_forecast42 | 7 | 1.799% | 0.938% | 2.113 |
| KRW-XRP | 중기 | 스트레스 | score | 18 | 0.169% | 1.391% | 1.034 |
| KRW-XRP | 중기 | 스트레스 | research_persistence | 15 | 1.963% | 1.031% | 1.596 |
| KRW-XRP | 중기 | 스트레스 | research_forecast6 | 5 | 2.163% | 1.132% | 3.543 |
| KRW-XRP | 중기 | 스트레스 | research_forecast18 | 5 | 2.533% | 0.963% | 3.984 |
| KRW-XRP | 중기 | 스트레스 | research_forecast42 | 6 | 1.884% | 1.023% | 2.343 |
| KRW-XRP | 최근 | 기본 | score | 16 | 0.074% | 1.981% | 1.022 |
| KRW-XRP | 최근 | 기본 | research_persistence | 7 | 1.753% | 0.746% | 3.027 |
| KRW-XRP | 최근 | 기본 | research_forecast6 | 5 | -0.826% | 1.463% | 0.489 |
| KRW-XRP | 최근 | 기본 | research_forecast18 | 4 | -1.509% | 1.509% | 0.000 |
| KRW-XRP | 최근 | 기본 | research_forecast42 | 0 | 0.000% | 0.000% | 0.000 |
| KRW-XRP | 최근 | 스트레스 | score | 16 | -0.652% | 2.217% | 0.838 |
| KRW-XRP | 최근 | 스트레스 | research_persistence | 8 | 0.981% | 1.332% | 1.653 |
| KRW-XRP | 최근 | 스트레스 | research_forecast6 | 5 | -1.160% | 1.700% | 0.396 |
| KRW-XRP | 최근 | 스트레스 | research_forecast18 | 4 | -1.709% | 1.709% | 0.000 |
| KRW-XRP | 최근 | 스트레스 | research_forecast42 | 0 | 0.000% | 0.000% | 0.000 |

## 지속 신호 비교군 대비 차이

| 후보 | 종목 | 구간 | 차이(%p) |
|---|---|---|---:|
| research_forecast6 | KRW-BTC | 중기 | -0.711 |
| research_forecast6 | KRW-BTC | 최근 | -0.641 |
| research_forecast6 | KRW-ETH | 중기 | -0.461 |
| research_forecast6 | KRW-ETH | 최근 | -0.764 |
| research_forecast6 | KRW-XRP | 중기 | -0.359 |
| research_forecast6 | KRW-XRP | 최근 | -2.580 |
| research_forecast18 | KRW-BTC | 중기 | -0.986 |
| research_forecast18 | KRW-BTC | 최근 | -1.436 |
| research_forecast18 | KRW-ETH | 중기 | 0.941 |
| research_forecast18 | KRW-ETH | 최근 | -0.959 |
| research_forecast18 | KRW-XRP | 중기 | -0.360 |
| research_forecast18 | KRW-XRP | 최근 | -3.263 |
| research_forecast42 | KRW-BTC | 중기 | -0.205 |
| research_forecast42 | KRW-BTC | 최근 | -0.834 |
| research_forecast42 | KRW-ETH | 중기 | -2.056 |
| research_forecast42 | KRW-ETH | 최근 | -1.146 |
| research_forecast42 | KRW-XRP | 중기 | -1.353 |
| research_forecast42 | KRW-XRP | 최근 | -1.753 |

원본 및 입력 SHA256: logs/T025-results.json. 운영 변경/배포 없음.

## 공통 Trader 리플레이

- KRW-BTC/research_forecast6: 일치, 4거래, 진입100.0%/청산100.0%, 오류0.
- KRW-BTC/research_forecast18: 일치, 3거래, 진입100.0%/청산100.0%, 오류0.
- KRW-BTC/research_forecast42: 일치, 3거래, 진입100.0%/청산100.0%, 오류0.
- KRW-ETH/research_forecast6: 일치, 4거래, 진입100.0%/청산100.0%, 오류0.
- KRW-ETH/research_forecast18: 일치, 1거래, 진입100.0%/청산100.0%, 오류0.
- KRW-ETH/research_forecast42: 일치, 2거래, 진입100.0%/청산100.0%, 오류0.
- KRW-XRP/research_forecast6: 일치, 5거래, 진입100.0%/청산100.0%, 오류0.
- KRW-XRP/research_forecast18: 일치, 4거래, 진입100.0%/청산100.0%, 오류0.
- KRW-XRP/research_forecast42: 일치, 0거래, 진입100.0%/청산100.0%, 오류0.
