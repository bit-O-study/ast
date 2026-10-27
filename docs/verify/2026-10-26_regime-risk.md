# 국면 진입과 공통 위험관리 · 2026-10-26

T029 사전 고정2후보/2비교군·72개 비교. T018 고정시세/3연속구간/준비200봉. 별도1천만원 계좌·매수100만원 상한, 최초손절/청산 동일. 기본 편도 비용0.04%+슬리피지0.05%, 스트레스0.25%+0.10%(계정 요율 가정). 구간별 현금 재시작/끝 청산, 공백 보간 없음. 단일진입 백테스트 일일/누적손실 차단 미적용 제한 유지.

이미 관찰한 데이터의 후속 탐색이며 독립 검증이 아니다. 후반 두 기간 전종목 양수·score 초과/평균MDD/스트레스/30거래 기준을 모두 요구한다. 상세 명세: docs/tasks/T-029-regime-risk.md.

- research_regimeEvery: **탈락**. 중기: 기존 대비 평균 수익률 개선 부족 / 중기: 수익 종목 2개 미만 / 중기: 평균 낙폭 한도 초과 / 중기: 비용 스트레스 평균 수익률 비양수 / 최근: 기존 대비 평균 수익률 개선 부족 / 최근: 평균 낙폭 한도 초과 / 최근: 비용 스트레스 평균 수익률 비양수 / 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족 / 중기/KRW-ETH: 양수·기존 초과 동시 미충족 / 최근/KRW-ETH: 양수·기존 초과 동시 미충족 / 중기/KRW-XRP: 양수·기존 초과 동시 미충족
- research_regimeDaily: **탈락**. 중기: 기존 대비 평균 수익률 개선 부족 / 중기: 수익 종목 2개 미만 / 중기: 평균 낙폭 한도 초과 / 중기: 비용 스트레스 평균 수익률 비양수 / 최근: 기존 대비 평균 수익률 개선 부족 / 최근: 수익 종목 2개 미만 / 최근: 비용 스트레스 평균 수익률 비양수 / 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족 / 중기/KRW-ETH: 양수·기존 초과 동시 미충족 / 최근/KRW-ETH: 양수·기존 초과 동시 미충족 / 중기/KRW-XRP: 양수·기존 초과 동시 미충족 / 최근/KRW-XRP: 양수·기존 초과 동시 미충족

| 종목 | 구간 | 비용 | 후보 | 거래 | 수익률 | MDD | PF |
|---|---|---|---|---:|---:|---:|---:|
| KRW-BTC | 초기 | 기본 | score | 27 | 3.363% | 1.053% | 2.384 |
| KRW-BTC | 초기 | 기본 | research_persistence | 21 | 3.138% | 0.907% | 2.365 |
| KRW-BTC | 초기 | 기본 | research_regimeEvery | 102 | 1.928% | 2.520% | 1.206 |
| KRW-BTC | 초기 | 기본 | research_regimeDaily | 54 | 0.976% | 1.915% | 1.156 |
| KRW-BTC | 초기 | 스트레스 | score | 28 | 0.983% | 1.130% | 1.252 |
| KRW-BTC | 초기 | 스트레스 | research_persistence | 21 | 1.469% | 1.155% | 1.475 |
| KRW-BTC | 초기 | 스트레스 | research_regimeEvery | 102 | -3.820% | 4.896% | 0.720 |
| KRW-BTC | 초기 | 스트레스 | research_regimeDaily | 55 | -1.759% | 2.854% | 0.789 |
| KRW-BTC | 중기 | 기본 | score | 24 | -0.641% | 1.166% | 0.803 |
| KRW-BTC | 중기 | 기본 | research_persistence | 16 | -0.474% | 1.048% | 0.776 |
| KRW-BTC | 중기 | 기본 | research_regimeEvery | 81 | -0.488% | 1.656% | 0.924 |
| KRW-BTC | 중기 | 기본 | research_regimeDaily | 42 | -1.065% | 1.560% | 0.736 |
| KRW-BTC | 중기 | 스트레스 | score | 25 | -2.041% | 2.170% | 0.521 |
| KRW-BTC | 중기 | 스트레스 | research_persistence | 16 | -1.249% | 1.299% | 0.533 |
| KRW-BTC | 중기 | 스트레스 | research_regimeEvery | 79 | -4.718% | 4.718% | 0.478 |
| KRW-BTC | 중기 | 스트레스 | research_regimeDaily | 42 | -3.041% | 3.211% | 0.455 |
| KRW-BTC | 최근 | 기본 | score | 11 | 1.055% | 0.631% | 2.454 |
| KRW-BTC | 최근 | 기본 | research_persistence | 9 | 1.099% | 0.288% | 3.407 |
| KRW-BTC | 최근 | 기본 | research_regimeEvery | 39 | 0.065% | 1.334% | 1.025 |
| KRW-BTC | 최근 | 기본 | research_regimeDaily | 22 | 0.349% | 1.092% | 1.200 |
| KRW-BTC | 최근 | 스트레스 | score | 12 | 0.017% | 1.397% | 1.012 |
| KRW-BTC | 최근 | 스트레스 | research_persistence | 9 | 0.174% | 0.832% | 1.170 |
| KRW-BTC | 최근 | 스트레스 | research_regimeEvery | 41 | -2.556% | 2.756% | 0.457 |
| KRW-BTC | 최근 | 스트레스 | research_regimeDaily | 23 | -1.040% | 1.589% | 0.607 |
| KRW-ETH | 초기 | 기본 | score | 27 | -0.692% | 4.449% | 0.883 |
| KRW-ETH | 초기 | 기본 | research_persistence | 18 | 0.490% | 2.671% | 1.125 |
| KRW-ETH | 초기 | 기본 | research_regimeEvery | 130 | -4.468% | 5.441% | 0.765 |
| KRW-ETH | 초기 | 기본 | research_regimeDaily | 68 | 1.298% | 2.530% | 1.140 |
| KRW-ETH | 초기 | 스트레스 | score | 27 | -1.837% | 4.995% | 0.732 |
| KRW-ETH | 초기 | 스트레스 | research_persistence | 18 | -0.368% | 3.063% | 0.916 |
| KRW-ETH | 초기 | 스트레스 | research_regimeEvery | 129 | -10.914% | 11.586% | 0.535 |
| KRW-ETH | 초기 | 스트레스 | research_regimeDaily | 68 | -2.177% | 4.414% | 0.813 |
| KRW-ETH | 중기 | 기본 | score | 23 | 2.200% | 1.806% | 1.466 |
| KRW-ETH | 중기 | 기본 | research_persistence | 18 | 2.814% | 1.365% | 1.945 |
| KRW-ETH | 중기 | 기본 | research_regimeEvery | 82 | 1.728% | 3.423% | 1.160 |
| KRW-ETH | 중기 | 기본 | research_regimeDaily | 50 | 0.503% | 2.508% | 1.066 |
| KRW-ETH | 중기 | 스트레스 | score | 22 | 1.579% | 2.094% | 1.317 |
| KRW-ETH | 중기 | 스트레스 | research_persistence | 18 | 1.940% | 1.541% | 1.557 |
| KRW-ETH | 중기 | 스트레스 | research_regimeEvery | 82 | -1.953% | 5.470% | 0.855 |
| KRW-ETH | 중기 | 스트레스 | research_regimeDaily | 50 | -1.904% | 3.714% | 0.800 |
| KRW-ETH | 최근 | 기본 | score | 12 | -0.721% | 1.687% | 0.607 |
| KRW-ETH | 최근 | 기본 | research_persistence | 7 | 0.796% | 0.613% | 2.183 |
| KRW-ETH | 최근 | 기본 | research_regimeEvery | 34 | -0.460% | 2.117% | 0.845 |
| KRW-ETH | 최근 | 기본 | research_regimeDaily | 19 | -0.639% | 1.611% | 0.664 |
| KRW-ETH | 최근 | 스트레스 | score | 12 | -1.327% | 2.079% | 0.424 |
| KRW-ETH | 최근 | 스트레스 | research_persistence | 7 | 0.436% | 0.765% | 1.498 |
| KRW-ETH | 최근 | 스트레스 | research_regimeEvery | 37 | -1.702% | 3.148% | 0.598 |
| KRW-ETH | 최근 | 스트레스 | research_regimeDaily | 20 | -1.861% | 2.121% | 0.352 |
| KRW-XRP | 초기 | 기본 | score | 32 | 2.844% | 4.907% | 1.265 |
| KRW-XRP | 초기 | 기본 | research_persistence | 17 | 7.988% | 2.494% | 2.796 |
| KRW-XRP | 초기 | 기본 | research_regimeEvery | 122 | 2.249% | 6.512% | 1.098 |
| KRW-XRP | 초기 | 기본 | research_regimeDaily | 66 | 0.801% | 5.890% | 1.064 |
| KRW-XRP | 초기 | 스트레스 | score | 31 | 1.090% | 6.038% | 1.097 |
| KRW-XRP | 초기 | 스트레스 | research_persistence | 16 | 6.920% | 3.228% | 2.591 |
| KRW-XRP | 초기 | 스트레스 | research_regimeEvery | 121 | -3.777% | 10.499% | 0.857 |
| KRW-XRP | 초기 | 스트레스 | research_regimeDaily | 66 | -2.580% | 8.290% | 0.829 |
| KRW-XRP | 중기 | 기본 | score | 20 | 1.255% | 1.197% | 1.269 |
| KRW-XRP | 중기 | 기본 | research_persistence | 15 | 3.152% | 0.941% | 2.158 |
| KRW-XRP | 중기 | 기본 | research_regimeEvery | 111 | -4.117% | 5.824% | 0.731 |
| KRW-XRP | 중기 | 기본 | research_regimeDaily | 69 | -2.331% | 4.033% | 0.752 |
| KRW-XRP | 중기 | 스트레스 | score | 18 | 0.169% | 1.391% | 1.034 |
| KRW-XRP | 중기 | 스트레스 | research_persistence | 15 | 1.963% | 1.031% | 1.596 |
| KRW-XRP | 중기 | 스트레스 | research_regimeEvery | 113 | -9.844% | 10.223% | 0.502 |
| KRW-XRP | 중기 | 스트레스 | research_regimeDaily | 70 | -5.211% | 5.815% | 0.577 |
| KRW-XRP | 최근 | 기본 | score | 16 | 0.074% | 1.981% | 1.022 |
| KRW-XRP | 최근 | 기본 | research_persistence | 7 | 1.753% | 0.746% | 3.027 |
| KRW-XRP | 최근 | 기본 | research_regimeEvery | 44 | 0.362% | 3.402% | 1.065 |
| KRW-XRP | 최근 | 기본 | research_regimeDaily | 28 | -1.150% | 1.949% | 0.661 |
| KRW-XRP | 최근 | 스트레스 | score | 16 | -0.652% | 2.217% | 0.838 |
| KRW-XRP | 최근 | 스트레스 | research_persistence | 8 | 0.981% | 1.332% | 1.653 |
| KRW-XRP | 최근 | 스트레스 | research_regimeEvery | 44 | -2.000% | 4.363% | 0.726 |
| KRW-XRP | 최근 | 스트레스 | research_regimeDaily | 28 | -2.661% | 3.132% | 0.429 |

## 지속 신호 비교군 대비 차이

| 후보 | 종목 | 구간 | 차이(%p) |
|---|---|---|---:|
| research_regimeEvery | KRW-BTC | 중기 | -0.015 |
| research_regimeEvery | KRW-BTC | 최근 | -1.034 |
| research_regimeEvery | KRW-ETH | 중기 | -1.086 |
| research_regimeEvery | KRW-ETH | 최근 | -1.257 |
| research_regimeEvery | KRW-XRP | 중기 | -7.269 |
| research_regimeEvery | KRW-XRP | 최근 | -1.391 |
| research_regimeDaily | KRW-BTC | 중기 | -0.591 |
| research_regimeDaily | KRW-BTC | 최근 | -0.750 |
| research_regimeDaily | KRW-ETH | 중기 | -2.311 |
| research_regimeDaily | KRW-ETH | 최근 | -1.435 |
| research_regimeDaily | KRW-XRP | 중기 | -5.483 |
| research_regimeDaily | KRW-XRP | 최근 | -2.904 |

원본 및 입력 SHA256: logs/T029-results.json. 운영 변경/배포 없음.

## 공통 Trader 리플레이

- KRW-BTC/research_regimeEvery: 일치, 39거래, 진입100.0%/청산100.0%, 오류0.
- KRW-BTC/research_regimeDaily: 일치, 22거래, 진입100.0%/청산100.0%, 오류0.
- KRW-ETH/research_regimeEvery: 일치, 34거래, 진입100.0%/청산100.0%, 오류0.
- KRW-ETH/research_regimeDaily: 일치, 19거래, 진입100.0%/청산100.0%, 오류0.
- KRW-XRP/research_regimeEvery: 일치, 44거래, 진입100.0%/청산100.0%, 오류0.
- KRW-XRP/research_regimeDaily: 일치, 28거래, 진입100.0%/청산100.0%, 오류0.
