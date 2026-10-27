# 상승국면 눌림 회복 · 2026-10-26

T030 사전 고정3후보/2비교군·90개 비교. T018 고정시세/3연속구간/준비200봉. 별도1천만원 계좌·매수100만원 상한, 최초손절/청산 동일. 기본 편도 비용0.04%+슬리피지0.05%, 스트레스0.25%+0.10%(계정 요율 가정). 구간별 현금 재시작/끝 청산, 공백 보간 없음. 단일진입 백테스트 일일/누적손실 차단 미적용 제한 유지.

이미 관찰한 데이터의 후속 탐색이며 독립 검증이 아니다. 후반 두 기간 전종목 양수·score 초과/평균MDD/스트레스/30거래 기준을 모두 요구한다. 상세 명세: docs/tasks/T-030-pullback-recovery.md.

- research_recovery_rsi: **탈락**. 중기: 기존 대비 평균 수익률 개선 부족 / 중기: 수익 종목 2개 미만 / 중기: 비용 스트레스 평균 수익률 비양수 / 최근: 기존 대비 평균 수익률 개선 부족 / 최근: 수익 종목 2개 미만 / 최근: 비용 스트레스 평균 수익률 비양수 / 후반 거래 14건: 최소 30건 미달 / 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족 / 중기/KRW-ETH: 양수·기존 초과 동시 미충족 / 최근/KRW-ETH: 양수·기존 초과 동시 미충족 / 중기/KRW-XRP: 양수·기존 초과 동시 미충족 / 최근/KRW-XRP: 양수·기존 초과 동시 미충족
- research_recovery_band: **탈락**. 중기: 기존 대비 평균 수익률 개선 부족 / 중기: 수익 종목 2개 미만 / 중기: 비용 스트레스 평균 수익률 비양수 / 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족 / 중기/KRW-ETH: 양수·기존 초과 동시 미충족 / 중기/KRW-XRP: 양수·기존 초과 동시 미충족
- research_recovery_average: **탈락**. 중기: 기존 대비 평균 수익률 개선 부족 / 최근: 기존 대비 평균 수익률 개선 부족 / 최근: 수익 종목 2개 미만 / 최근: 비용 스트레스 평균 수익률 비양수 / 중기/KRW-BTC: 양수·기존 초과 동시 미충족 / 최근/KRW-BTC: 양수·기존 초과 동시 미충족 / 중기/KRW-ETH: 양수·기존 초과 동시 미충족 / 최근/KRW-ETH: 양수·기존 초과 동시 미충족 / 중기/KRW-XRP: 양수·기존 초과 동시 미충족 / 최근/KRW-XRP: 양수·기존 초과 동시 미충족

| 종목 | 구간 | 비용 | 후보 | 거래 | 수익률 | MDD | PF |
|---|---|---|---|---:|---:|---:|---:|
| KRW-BTC | 초기 | 기본 | score | 27 | 3.363% | 1.053% | 2.384 |
| KRW-BTC | 초기 | 기본 | research_persistence | 21 | 3.138% | 0.907% | 2.365 |
| KRW-BTC | 초기 | 기본 | research_recovery_rsi | 1 | -0.109% | 0.109% | 0.000 |
| KRW-BTC | 초기 | 기본 | research_recovery_band | 16 | -0.509% | 1.770% | 0.722 |
| KRW-BTC | 초기 | 기본 | research_recovery_average | 5 | 0.201% | 0.396% | 1.580 |
| KRW-BTC | 초기 | 스트레스 | score | 28 | 0.983% | 1.130% | 1.252 |
| KRW-BTC | 초기 | 스트레스 | research_persistence | 21 | 1.469% | 1.155% | 1.475 |
| KRW-BTC | 초기 | 스트레스 | research_recovery_rsi | 1 | -0.161% | 0.161% | 0.000 |
| KRW-BTC | 초기 | 스트레스 | research_recovery_band | 16 | -1.306% | 2.373% | 0.472 |
| KRW-BTC | 초기 | 스트레스 | research_recovery_average | 6 | 0.068% | 0.532% | 1.135 |
| KRW-BTC | 중기 | 기본 | score | 24 | -0.641% | 1.166% | 0.803 |
| KRW-BTC | 중기 | 기본 | research_persistence | 16 | -0.474% | 1.048% | 0.776 |
| KRW-BTC | 중기 | 기본 | research_recovery_rsi | 4 | -0.267% | 0.302% | 0.000 |
| KRW-BTC | 중기 | 기본 | research_recovery_band | 8 | -0.228% | 0.393% | 0.514 |
| KRW-BTC | 중기 | 기본 | research_recovery_average | 9 | -0.529% | 0.529% | 0.414 |
| KRW-BTC | 중기 | 스트레스 | score | 25 | -2.041% | 2.170% | 0.521 |
| KRW-BTC | 중기 | 스트레스 | research_persistence | 16 | -1.249% | 1.299% | 0.533 |
| KRW-BTC | 중기 | 스트레스 | research_recovery_rsi | 4 | -0.473% | 0.473% | 0.000 |
| KRW-BTC | 중기 | 스트레스 | research_recovery_band | 8 | -0.764% | 0.764% | 0.143 |
| KRW-BTC | 중기 | 스트레스 | research_recovery_average | 9 | -0.969% | 0.969% | 0.227 |
| KRW-BTC | 최근 | 기본 | score | 11 | 1.055% | 0.631% | 2.454 |
| KRW-BTC | 최근 | 기본 | research_persistence | 9 | 1.099% | 0.288% | 3.407 |
| KRW-BTC | 최근 | 기본 | research_recovery_rsi | 0 | 0.000% | 0.000% | 0.000 |
| KRW-BTC | 최근 | 기본 | research_recovery_band | 7 | 0.368% | 0.277% | 2.753 |
| KRW-BTC | 최근 | 기본 | research_recovery_average | 1 | -0.156% | 0.156% | 0.000 |
| KRW-BTC | 최근 | 스트레스 | score | 12 | 0.017% | 1.397% | 1.012 |
| KRW-BTC | 최근 | 스트레스 | research_persistence | 9 | 0.174% | 0.832% | 1.170 |
| KRW-BTC | 최근 | 스트레스 | research_recovery_rsi | 0 | 0.000% | 0.000% | 0.000 |
| KRW-BTC | 최근 | 스트레스 | research_recovery_band | 6 | -0.026% | 0.379% | 0.938 |
| KRW-BTC | 최근 | 스트레스 | research_recovery_average | 2 | -0.469% | 0.496% | 0.000 |
| KRW-ETH | 초기 | 기본 | score | 27 | -0.692% | 4.449% | 0.883 |
| KRW-ETH | 초기 | 기본 | research_persistence | 18 | 0.490% | 2.671% | 1.125 |
| KRW-ETH | 초기 | 기본 | research_recovery_rsi | 9 | -0.107% | 1.212% | 0.902 |
| KRW-ETH | 초기 | 기본 | research_recovery_band | 17 | -0.402% | 2.021% | 0.826 |
| KRW-ETH | 초기 | 기본 | research_recovery_average | 8 | 0.029% | 1.022% | 1.021 |
| KRW-ETH | 초기 | 스트레스 | score | 27 | -1.837% | 4.995% | 0.732 |
| KRW-ETH | 초기 | 스트레스 | research_persistence | 18 | -0.368% | 3.063% | 0.916 |
| KRW-ETH | 초기 | 스트레스 | research_recovery_rsi | 9 | -0.553% | 1.466% | 0.587 |
| KRW-ETH | 초기 | 스트레스 | research_recovery_band | 17 | -1.239% | 2.423% | 0.582 |
| KRW-ETH | 초기 | 스트레스 | research_recovery_average | 7 | -0.459% | 1.126% | 0.726 |
| KRW-ETH | 중기 | 기본 | score | 23 | 2.200% | 1.806% | 1.466 |
| KRW-ETH | 중기 | 기본 | research_persistence | 18 | 2.814% | 1.365% | 1.945 |
| KRW-ETH | 중기 | 기본 | research_recovery_rsi | 3 | -0.298% | 0.934% | 0.388 |
| KRW-ETH | 중기 | 기본 | research_recovery_band | 12 | -0.993% | 1.560% | 0.320 |
| KRW-ETH | 중기 | 기본 | research_recovery_average | 8 | 0.836% | 0.666% | 1.816 |
| KRW-ETH | 중기 | 스트레스 | score | 22 | 1.579% | 2.094% | 1.317 |
| KRW-ETH | 중기 | 스트레스 | research_persistence | 18 | 1.940% | 1.541% | 1.557 |
| KRW-ETH | 중기 | 스트레스 | research_recovery_rsi | 3 | -0.453% | 0.987% | 0.232 |
| KRW-ETH | 중기 | 스트레스 | research_recovery_band | 12 | -1.603% | 2.022% | 0.208 |
| KRW-ETH | 중기 | 스트레스 | research_recovery_average | 8 | 0.457% | 0.865% | 1.357 |
| KRW-ETH | 최근 | 기본 | score | 12 | -0.721% | 1.687% | 0.607 |
| KRW-ETH | 최근 | 기본 | research_persistence | 7 | 0.796% | 0.613% | 2.183 |
| KRW-ETH | 최근 | 기본 | research_recovery_rsi | 0 | 0.000% | 0.000% | 0.000 |
| KRW-ETH | 최근 | 기본 | research_recovery_band | 10 | 0.003% | 0.521% | 1.004 |
| KRW-ETH | 최근 | 기본 | research_recovery_average | 5 | -0.538% | 0.797% | 0.238 |
| KRW-ETH | 최근 | 스트레스 | score | 12 | -1.327% | 2.079% | 0.424 |
| KRW-ETH | 최근 | 스트레스 | research_persistence | 7 | 0.436% | 0.765% | 1.498 |
| KRW-ETH | 최근 | 스트레스 | research_recovery_rsi | 0 | 0.000% | 0.000% | 0.000 |
| KRW-ETH | 최근 | 스트레스 | research_recovery_band | 10 | -0.435% | 0.854% | 0.549 |
| KRW-ETH | 최근 | 스트레스 | research_recovery_average | 6 | -0.237% | 0.656% | 0.739 |
| KRW-XRP | 초기 | 기본 | score | 32 | 2.844% | 4.907% | 1.265 |
| KRW-XRP | 초기 | 기본 | research_persistence | 17 | 7.988% | 2.494% | 2.796 |
| KRW-XRP | 초기 | 기본 | research_recovery_rsi | 6 | -0.824% | 1.489% | 0.258 |
| KRW-XRP | 초기 | 기본 | research_recovery_band | 28 | -1.228% | 2.084% | 0.670 |
| KRW-XRP | 초기 | 기본 | research_recovery_average | 9 | 0.016% | 2.037% | 1.008 |
| KRW-XRP | 초기 | 스트레스 | score | 31 | 1.090% | 6.038% | 1.097 |
| KRW-XRP | 초기 | 스트레스 | research_persistence | 16 | 6.920% | 3.228% | 2.591 |
| KRW-XRP | 초기 | 스트레스 | research_recovery_rsi | 6 | -1.131% | 1.741% | 0.147 |
| KRW-XRP | 초기 | 스트레스 | research_recovery_band | 27 | -2.397% | 3.129% | 0.479 |
| KRW-XRP | 초기 | 스트레스 | research_recovery_average | 8 | -0.122% | 1.902% | 0.941 |
| KRW-XRP | 중기 | 기본 | score | 20 | 1.255% | 1.197% | 1.269 |
| KRW-XRP | 중기 | 기본 | research_persistence | 15 | 3.152% | 0.941% | 2.158 |
| KRW-XRP | 중기 | 기본 | research_recovery_rsi | 7 | -0.917% | 0.917% | 0.084 |
| KRW-XRP | 중기 | 기본 | research_recovery_band | 19 | -1.053% | 1.627% | 0.429 |
| KRW-XRP | 중기 | 기본 | research_recovery_average | 5 | 1.022% | 0.398% | 3.550 |
| KRW-XRP | 중기 | 스트레스 | score | 18 | 0.169% | 1.391% | 1.034 |
| KRW-XRP | 중기 | 스트레스 | research_persistence | 15 | 1.963% | 1.031% | 1.596 |
| KRW-XRP | 중기 | 스트레스 | research_recovery_rsi | 7 | -1.275% | 1.275% | 0.015 |
| KRW-XRP | 중기 | 스트레스 | research_recovery_band | 19 | -1.999% | 2.376% | 0.247 |
| KRW-XRP | 중기 | 스트레스 | research_recovery_average | 5 | 0.782% | 0.530% | 2.557 |
| KRW-XRP | 최근 | 기본 | score | 16 | 0.074% | 1.981% | 1.022 |
| KRW-XRP | 최근 | 기본 | research_persistence | 7 | 1.753% | 0.746% | 3.027 |
| KRW-XRP | 최근 | 기본 | research_recovery_rsi | 0 | 0.000% | 0.000% | 0.000 |
| KRW-XRP | 최근 | 기본 | research_recovery_band | 9 | 0.949% | 0.469% | 3.147 |
| KRW-XRP | 최근 | 기본 | research_recovery_average | 3 | -0.725% | 1.158% | 0.251 |
| KRW-XRP | 최근 | 스트레스 | score | 16 | -0.652% | 2.217% | 0.838 |
| KRW-XRP | 최근 | 스트레스 | research_persistence | 8 | 0.981% | 1.332% | 1.653 |
| KRW-XRP | 최근 | 스트레스 | research_recovery_rsi | 0 | 0.000% | 0.000% | 0.000 |
| KRW-XRP | 최근 | 스트레스 | research_recovery_band | 9 | 0.548% | 0.524% | 1.784 |
| KRW-XRP | 최근 | 스트레스 | research_recovery_average | 3 | -0.877% | 1.258% | 0.178 |

## 지속 신호 비교군 대비 차이

| 후보 | 종목 | 구간 | 차이(%p) |
|---|---|---|---:|
| research_recovery_rsi | KRW-BTC | 중기 | 0.207 |
| research_recovery_rsi | KRW-BTC | 최근 | -1.099 |
| research_recovery_rsi | KRW-ETH | 중기 | -3.113 |
| research_recovery_rsi | KRW-ETH | 최근 | -0.796 |
| research_recovery_rsi | KRW-XRP | 중기 | -4.069 |
| research_recovery_rsi | KRW-XRP | 최근 | -1.753 |
| research_recovery_band | KRW-BTC | 중기 | 0.245 |
| research_recovery_band | KRW-BTC | 최근 | -0.731 |
| research_recovery_band | KRW-ETH | 중기 | -3.807 |
| research_recovery_band | KRW-ETH | 최근 | -0.794 |
| research_recovery_band | KRW-XRP | 중기 | -4.205 |
| research_recovery_band | KRW-XRP | 최근 | -0.805 |
| research_recovery_average | KRW-BTC | 중기 | -0.056 |
| research_recovery_average | KRW-BTC | 최근 | -1.254 |
| research_recovery_average | KRW-ETH | 중기 | -1.978 |
| research_recovery_average | KRW-ETH | 최근 | -1.334 |
| research_recovery_average | KRW-XRP | 중기 | -2.130 |
| research_recovery_average | KRW-XRP | 최근 | -2.479 |

원본 및 입력 SHA256: logs/T030-results.json. 운영 변경/배포 없음.

## 공통 Trader 리플레이

- KRW-BTC/research_recovery_rsi: 일치, 0거래, 진입100.0%/청산100.0%, 오류0.
- KRW-BTC/research_recovery_band: 일치, 7거래, 진입100.0%/청산100.0%, 오류0.
- KRW-BTC/research_recovery_average: 일치, 1거래, 진입100.0%/청산100.0%, 오류0.
- KRW-ETH/research_recovery_rsi: 일치, 0거래, 진입100.0%/청산100.0%, 오류0.
- KRW-ETH/research_recovery_band: 일치, 10거래, 진입100.0%/청산100.0%, 오류0.
- KRW-ETH/research_recovery_average: 일치, 5거래, 진입100.0%/청산100.0%, 오류0.
- KRW-XRP/research_recovery_rsi: 일치, 0거래, 진입100.0%/청산100.0%, 오류0.
- KRW-XRP/research_recovery_band: 일치, 9거래, 진입100.0%/청산100.0%, 오류0.
- KRW-XRP/research_recovery_average: 일치, 3거래, 진입100.0%/청산100.0%, 오류0.
