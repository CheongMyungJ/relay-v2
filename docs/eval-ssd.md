# SSD 펌웨어 연속 평가 (Cosmos+ OpenSSD)

- 상태: 시나리오 팩(Work 21개의 숨긴 시험, 정답·함정 패치) 작성 끝, 실제 실행 전 (2026-10-13)
- 대상: [Cosmos+ OpenSSD](https://github.com/Cosmos-OpenSSD/Cosmos-plus-OpenSSD)의 `GreedyFTL-3.0.0` 펌웨어 (C, GPLv3)
- 시나리오 팩: 포크 `CheongMyungJ/Cosmos-plus-OpenSSD`의 `relay-eval` 브랜치 `relay-eval/scenarios/40-ssd-campaign/`. GPL 코드라 이 레포(MIT)에는 넣지 않고 `RELAY_EVAL_SCENARIOS`로 가리킨다 (`docs/eval.md` 7절)

## 1. 목적

`docs/eval.md`의 시나리오는 작은 JS 레포에서 Work 한두 개를 돈다. 여기서는 두 가지를 본다.

1. **낯선 큰 C 코드에서 relay로 설계 → 구현 → 정리 → 버그 수정을 이어 갈 수 있는지.** 설계 5건, 그 설계를 구현하는 기능 추가 10건, 리팩터링 3건, 버그 수정 3건을 한 레포에서 차례로 한다.
2. **지식이 쌓여 뒤 Work를 돕는지.** Work를 끝낼 때마다 도구가 그 브랜치를 main에 머지한다(PR 머지 흉내). 사람이 앞 Work에서 알려 준 팀 규칙과 도메인 사실이 뒤 Work에서 다시 필요하도록 짰다. 지식을 켠 relay와 끈 relay(`relay-off`)를 같은 연쇄로 돌려, 뒤 Work의 다시 알려 줌(PM1), 숨긴 시험(PM2), 질문 수, 사람 차례를 견준다(`docs/knowledge-experiment/protocol.md` 4절의 지표).

## 2. 시험할 수 있게 만든 것

펌웨어는 Zynq 보드의 NAND 제어기(NSC)와 NVMe 호스트 DMA 레지스터를 직접 만진다. 기준 레포에 호스트 시뮬레이터를 둬서 PC에서 빌드하고 돌린다.

| 부분          | 내용                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firmware/`   | GreedyFTL-3.0.0 그대로. 바꾼 것은 `ftl_config.h`의 기하 상수를 `#ifndef`로 감싼 것뿐(시뮬레이터가 작은 기하로 빌드)                                                                                            |
| `host/sim/`   | NSC 레지스터 함수(`V2F*`)를 흉내 내는 NAND 모델(페이지·spare 저장, 프로그램·지우기·읽기 실패와 비트 오류 주입, 전원 차단), NVMe 호스트 쪽 함수(`host_lld`)를 흉내 내는 명령 제출·DMA·완료 큐, Xilinx 헤더 대역 |
| `host/tests/` | 기준 시험. `make test`로 돈다                                                                                                                                                                                  |
| 메모리        | 펌웨어는 `0x10000000` 같은 고정 DRAM 주소를 32비트 정수로 다룬다. 시뮬레이터는 64비트 리눅스에서 그 주소 범위를 `mmap(MAP_FIXED)`로 잡고 `-no-pie`로 빌드해 펌웨어 코드를 고치지 않는다                        |

숨긴 시험은 NVMe 명령 수준(명령 dword와 데이터를 넣고 완료 상태와 데이터를 봄)과 NAND 모델의 관찰(어느 페이지에 무엇이 쓰였나, spare 바이트, 지우기 횟수)로만 본다. 앞 Work에서 에이전트가 어떤 함수 이름으로 구현했든 뒤 Work의 시험이 컴파일되게 하려는 것이다. 숨긴 시험은 JS 감싸개(`node --test`)가 레포의 `firmware/**/*.c`와 `host/sim/*.c`를 모아 시험 C 파일과 함께 빌드해 돌린다.

시뮬레이터 기하: 2채널 × 2웨이(다이 4), LUN 2, LUN당 블록 32(+예비 4), 블록당 페이지 16, 페이지 16KiB(슬라이스 1개 = NVMe 블록 4개). 사용자 용량 약 40MiB.

### 2.1 시뮬레이터로 확인한 원래 펌웨어의 사실

시나리오를 짤 때 시뮬레이터로 확인했다(2026-10-13).

- B1: 쓰지 않은 LBA를 읽으면 버퍼에 남은 다른 LBA의 데이터가 나온다. 부분 슬라이스 쓰기도 그 버퍼로 읽기-수정-쓰기를 해 다른 LBA 데이터가 섞인다
- B2: 이름공간 끝에 걸친 쓰기가 성공으로 끝나고(끝 밖 LBA까지 씀), 끝 밖에서 시작하는 쓰기는 `ASSERT`로 펌웨어가 멈춘다
- B3: 위 부하에서 `FindFreeVirtualSliceForGc`의 "There is no available block" assert로 펌웨어가 죽는다. GC가 현재 블록을 희생으로 골랐을 때 새 현재 블록을 잡으면 사라진다
- 부팅할 때마다 사용자 블록을 모두 지운다(`InitBlockDieMap`의 `EraseUserBlockSpace`). 그래서 지금은 전원을 껐다 켜면 데이터가 남지 않는다. Flush 명령은 아무것도 하지 않고 완료하고, 정상 종료도 더러운 버퍼를 내리지 않는다. D2가 이것을 다룬다
- 정상 종료가 SHST를 완료(2)로 바꾼 뒤에 배드 블록 표(BBT)를 갱신한다. 호스트가 SHST를 보고 바로 전원을 끊으면 BBT 쓰기가 중간에 끊겨, 다음 부팅에서 BBT를 잃고 블록을 모두 배드로 잡는다. 정답은 Flush, 체크포인트, BBT 갱신을 모두 SHST 앞에 둔다(F2a, F4b)
- 고칠 수 없는 읽기(재시도 5번 뒤)와 ECC 경고가 그 블록을 그로운 배드로 표시한다(`request_schedule.c`). 읽기 실패만으로 블록의 다른 데이터까지 못 쓰게 된다. D4·F4a가 이것을 다룬다

정답을 만들며 걸린 것(시나리오의 함정이 됨):

- B1을 읽기 미스에서 버퍼를 0으로 채우는 것만으로 고치면, 그 버퍼 항목이 아직 NAND로 내보내는 중일 때(요청이 걸려 있음) 내보낼 데이터가 0으로 바뀐다. 걸린 요청이 끝나기를 기다린 뒤 채워야 한다(`b1-evict-order`)
- 복구가 열려 있던 현재 블록을 모두 닫으면 몇 번 껐다 켜면 빈 블록이 바닥난다. 다이마다 마지막으로 쓰던 블록을 이어 쓴다. 행 의존 표(`permittedProgPage`)도 되살려야 복구 뒤 읽기가 막히지 않는다
- 체크포인트의 순번이 같을 수 있어(쓴 것 없이 두 번 체크포인트) 체크포인트 번호를 따로 둔다(F5b)
- F3b의 기준은 "최대 - 최소 ≤ 120"으로는 맞출 수 없다(현재 블록 하나에 차가운 데이터와 뜨거운 데이터가 섞임). "가장 적게 지운 블록도 5번 넘게, 가장 많이 지운 블록이 110을 넘음(평준화가 돌았음)"으로 본다

## 3. 연쇄 (Work 21개)

한 실행이 같은 레포에서 Work 1부터 21까지 차례로 한다. 모든 Work 앞에서 도구가 앞 Work 브랜치를 main에 머지한다(`merge: true`, 4절). 사람은 한 사람이고 Work마다 사람 역할 세션은 새로 둔다(같은 사람이 그 Work의 사정만 받음, 앞 Work에서 알려 준 것은 `carry`로 "물으면 답함").

| #   | 유형   | 이름                   | 요청 (사람이 하는 말, 요약)                                                                                            |
| --- | ------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | 버그   | B1 빈 영역 읽기        | "새로 포맷한 디스크에서 아직 안 쓴 영역을 읽었더니 다른 파일 내용이 보인다"                                            |
| 2   | 버그   | B3 GC 이중 할당        | "가득 찬 디스크에서 작은 영역을 계속 덮어쓰다 다른 데이터도 쓰면 'There is no available block'으로 멈춘다" (재현 부하) |
| 3   | 설계   | D1 TRIM                | Dataset Management(deallocate) 지원 설계를 `docs/design/trim.md`에                                                     |
| 4   | 기능   | F1a TRIM 기본          | D1대로 슬라이스 전체 범위의 deallocate                                                                                 |
| 5   | 기능   | F1b TRIM 경계          | D1대로 부분 슬라이스, 범위 검사, Identify 광고                                                                         |
| 6   | 설계   | D2 전원 손실 복구      | 페이지 spare에 논리 주소·순번을 남기고 부팅 때 맵을 다시 세우는 설계를 `docs/design/power-loss.md`에                   |
| 7   | 기능   | F2a spare 메타와 Flush | D2대로 모든 프로그램(GC 복사 포함)에 메타를 쓰고, Flush와 정상 종료가 버퍼를 NAND에 내림                               |
| 8   | 기능   | F2b 부팅 복구          | D2대로 전원 차단 뒤 스캔으로 맵 복구                                                                                   |
| 9   | 리팩터 | R1 요청 채우기         | 흩어진 `reqPool[...]` 채우기를 함수로 모음                                                                             |
| 10  | 설계   | D3 마모 평준화         | 지우기 횟수로 빈 블록 고르기와 정적 마모 평준화 설계를 `docs/design/wear-leveling.md`에                                |
| 11  | 기능   | F3a 빈 블록 고르기     | D3대로 지우기 횟수가 가장 적은 빈 블록, 지우기 횟수 유지                                                               |
| 12  | 기능   | F3b 정적 평준화        | D3대로 차이가 문턱을 넘으면 차가운 블록 옮기기                                                                         |
| 13  | 버그   | B2 끝 넘는 쓰기        | "디스크 끝에 걸친 쓰기가 성공으로 끝나고 가끔 펌웨어가 멈춘다"                                                         |
| 14  | 설계   | D4 매체 오류           | 읽기 실패·프로그램 실패·그로운 배드 블록 처리 설계를 `docs/design/media-errors.md`에                                   |
| 15  | 기능   | F4a 읽기 오류 보고     | D4대로 고칠 수 없는 읽기는 NVMe 오류 상태로, 읽기 실패로 배드 표시하지 않음                                            |
| 16  | 기능   | F4b 블록 은퇴          | D4대로 프로그램 실패 블록을 은퇴시키고 데이터를 잃지 않음                                                              |
| 17  | 리팩터 | R2 리스트 통합         | 빈 블록 리스트와 GC 희생 리스트의 같은 연결 리스트 코드를 하나로                                                       |
| 18  | 설계   | D5 SMART               | Get Log Page(02h) 건강 정보 설계를 `docs/design/smart.md`에                                                            |
| 19  | 기능   | F5a SMART 값           | D5대로 카운터와 로그 페이지                                                                                            |
| 20  | 기능   | F5b SMART 유지         | D5대로 전원 주기를 넘어 카운터 유지, 비정상 종료 횟수                                                                  |
| 21  | 리팩터 | R3 스케줄러 나누기     | 974줄짜리 `request_schedule.c`의 채널별 스케줄링을 상태별 함수로                                                       |

B2(끝 넘는 쓰기)를 13번째에 둔 것은 D1에서 사람이 정한 범위 오류 원칙(K2)이 버그 수정에서 다시 필요하게 하려는 것이다. B3은 앞쪽(2번째)에 둬 뒤 Work의 GC 부하 시험이 그 버그로 흔들리지 않게 했다.

설계 Work는 코드를 바꾸지 않는다(범위 guard). 기능 Work의 요청은 설계 문서 경로와 바깥에서 부를 이름(NVMe 명령, 로그 페이지)만 말하고, 세부는 머지된 설계 문서와 사람에게서 온다.

### 3.1 Work마다 사람만 아는 것과 숨긴 시험

`K`는 여러 Work에 걸치는 지식(3.2), 괄호는 첫 Work에서의 나눔 방식(upfront 처음부터 말함 / on_ask 물으면 답함 / recall 짚어 주면 떠오름)이다.

| #   | 사람만 아는 것                                                                                                                                                                                                                          | 숨긴 시험 (guard는 앞 상태에서도 통과)                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| B1  | K3 동적 할당 금지(upfront) / K1 쓰지 않은 LBA는 0(on_ask) / 4KiB만 쓰는 앱도 있음(recall)                                                                                                                                               | 빈 LBA 읽기 0 / 부분 슬라이스 쓰기 뒤 나머지 0 / 내보내는 중인 버퍼 데이터 그대로(guard) / 기존 읽기·쓰기(guard) / K3(guard)       |
| B3  | 재현 부하(upfront) / 끝난 뒤 데이터 그대로(on_ask) / K3 carry                                                                                                                                                                           | 재현 부하에서 멈추지 않고 데이터 그대로 / GC(guard) / 기존 읽기·쓰기(guard)                                                        |
| D1  | K1 carry / 부분 슬라이스는 0으로(on_ask) / 더러운 버퍼는 버림(recall) / K2 범위 오류 80h·아무것도 처리 안 함(on_ask, 처음) / Identify 광고(on_ask)                                                                                      | 쟁점 4개(K1 쟁점은 `ask: false`) / 코드 안 바뀜(scope guard)                                                                       |
| F1a | 설계 문서 / K1·K3 carry / GC가 deallocate한 데이터를 옮기지 않음(on_ask)                                                                                                                                                                | 전체 슬라이스 deallocate 뒤 0 / 더러운 버퍼가 다시 살아나지 않음 / GC가 deallocate된 슬라이스를 복사하지 않음 / K3·읽기쓰기(guard) |
| F1b | 설계 문서 / K1·K2·K3 carry                                                                                                                                                                                                              | 부분 슬라이스 0 / 범위 오류 80h·아무것도 안 바뀜 / Identify ONCS.DSM, DLFEAT / K3(guard)                                           |
| D2  | K4 매직·버전·CRC32(on_ask) / K5 spare 첫 바이트 0xFF(recall) / 같은 LBA는 순번이 큰 것(on_ask) / deallocate도 전원 손실 뒤 유지(K1 carry, recall) / K9 SHST 전에 모두 내림(on_ask)                                                      | 쟁점 4개(K1 쟁점은 `ask: false`) / scope guard                                                                                     |
| F2a | 설계 문서 / K3·K4·K5·K9 carry                                                                                                                                                                                                           | 모든 사용자 페이지에 메타(GC 복사 포함) / Flush·정상 종료 뒤 NAND에 있음 / K5·K3(guard)                                            |
| F2b | 설계 문서 / K1·K3·K4·K5 carry                                                                                                                                                                                                           | 전원 차단 뒤 데이터와 최신 판 / 부팅이 지우지 않음 / deallocate가 되살아나지 않음 / 깨진 spare(CRC)는 버림 / K5(guard)             |
| R1  | 명령과 차례는 그대로(upfront) / K6 GC 읽기는 ECC 경고를 끈다(recall) / K3 carry                                                                                                                                                         | 같은 부하의 NAND 상태·명령 수가 기준과 같음(golden, guard) / GC 읽기 경고 꺼짐(guard) / K3(guard)                                  |
| D3  | K7 정격 P/E 3000(upfront) / K8 결정적 선택(on_ask) / 문턱 100, 한 번에 블록 하나(on_ask) / 지우기 횟수 유지(on_ask) / 옮기는 쓰기도 메타 규칙(carry, recall)                                                                            | 쟁점 4개(메타 규칙 쟁점은 `ask: false`) / scope guard                                                                              |
| F3a | 설계 문서 / K3·K4·K8 carry                                                                                                                                                                                                              | 가장 적게 지운 블록, 같으면 작은 번호, 껐다 켜도 유지 / GC(guard) / K3(guard)                                                      |
| F3b | 설계 문서 / K3·K5·K8 carry, 문턱 carry                                                                                                                                                                                                  | 차가운 블록도 옮겨 고르게 닳음 / K5·K3(guard)                                                                                      |
| B2  | K2 carry(on_ask) / 읽기도 같음(on_ask) / K3 carry                                                                                                                                                                                       | 끝을 넘는 읽기·쓰기 80h, 아무것도 안 바뀜, 끝까지는 성공 / 기존 읽기·쓰기(guard) / K3(guard)                                       |
| D4  | 81h, 재시도 뒤에만(on_ask) / 읽기 실패로 배드 표시하지 않음(recall) / 프로그램 실패는 다시 쓰고 은퇴(on_ask) / K2·K6 carry(recall) / K4 carry                                                                                           | 쟁점 5개(K2·K6 쟁점은 `ask: false`) / scope guard                                                                                  |
| F4a | 설계 문서 / 81h·배드 표시 안 함 carry / K3 carry                                                                                                                                                                                        | 81h, 다시 읽어도 81h, 재시도로 읽히면 성공, 다른 LBA 영향 없음 / 읽기 실패·경고로 배드 표시 안 함 / K3(guard)                      |
| F4b | 설계 문서 / 은퇴 carry / K3·K4·K5·K9 carry                                                                                                                                                                                              | 프로그램 실패에도 데이터 그대로, 블록 은퇴, 정상 종료 뒤에도 은퇴 유지 / K5·K3(guard)                                              |
| R2  | 명령과 차례는 그대로(upfront) / K8 carry: 같은 무효 수면 먼저 들어간 블록부터(recall) / K3 carry                                                                                                                                        | golden(guard) / GC(guard) / K3(guard)                                                                                              |
| D5  | Data Units 512바이트×1000 올림, 성공한 명령만 셈(on_ask) / Percentage Used = 평균 지우기 ÷ K7(carry) / 지원하지 않는 로그 09h(K2 원칙 carry) / Media Errors = 81h 수(carry) / Available Spare 100·문턱 10(on_ask) / 카운터 유지(on_ask) | 쟁점 4개(K7 쟁점은 `ask: false`) / scope guard                                                                                     |
| F5a | 설계 문서 / K3·K7 carry, Data Units·Media Errors carry                                                                                                                                                                                  | 명령 수, Data Units, 처음 값, 지원하지 않는 로그 09h, 짧은 길이 / Percentage Used, Media Errors / K3(guard)                        |
| F5b | 설계 문서 / K3·K4·K5 carry, 유지 carry                                                                                                                                                                                                  | 정상 종료 뒤 유지, Power Cycles, Unsafe Shutdowns / K5(guard)                                                                      |
| R3  | 명령과 차례는 그대로(upfront) / 상태 확인, 읽기 트리거, 지우기, 쓰기, 읽기 전송 차례는 지연 요구(recall) / K3 carry                                                                                                                     | golden(guard) / K3(guard)                                                                                                          |

설계 Work의 쟁점 가운데 앞 Work에서 사람이 이미 알려 준 지식(carry)에 기대는 것은 `ask: false`로 둬 문서에 맞게 적혔는지만 본다. 지식을 켠 쪽은 레포의 지식으로 묻지 않고 맞게 적을 수 있어야 하고, 끈 쪽은 묻거나(PM1) 틀린다.

리팩터링(R1, R2, R3)의 golden 시험은 같은 부하를 기준(`EVAL_BASE_DIR`, 그 Work를 시작한 머지된 main)과 결과에서 돌려 NAND 상태의 해시와 명령 수를 견준다. 앞 Work를 에이전트가 어떻게 구현했든 그 위에서 동작이 보존됐는지만 본다.

### 3.2 여러 Work에 걸치는 지식

| K   | 지식                                                                                               | 처음 | 다시 필요한 Work                   |
| --- | -------------------------------------------------------------------------------------------------- | ---- | ---------------------------------- |
| K1  | 쓰지 않거나 deallocate한 LBA는 0을 읽는다(전원 손실 뒤에도)                                        | B1   | D1, F1a, F1b, D2, F2b              |
| K2  | 잘못된 범위는 LBA Out of Range(80h), 일부만 처리하지 않는다                                        | D1   | F1b, B2, D4, D5                    |
| K3  | 펌웨어 코드에 동적 할당 금지. 새 표는 `memory_map.h`에 영역을 두고 `CheckConfigRestriction`에 검사 | B1   | 모든 기능·리팩터·버그 Work의 guard |
| K4  | 온플래시 형식에는 매직·버전·CRC32                                                                  | D2   | F2a, F2b, F3a, D4, F4b, F5b        |
| K5  | spare 첫 바이트(공장 배드 마크 자리)는 0xFF                                                        | D2   | F2a, F2b, D3, F3b, F4b, F5b        |
| K6  | GC 읽기는 ECC 경고를 끈다(일부러 다름)                                                             | R1   | D4                                 |
| K7  | 정격 P/E 3000회                                                                                    | D3   | D5, F5a                            |
| K8  | 같은 조건이면 결정적으로: 작은 번호, 오래된 것 먼저                                                | D3   | F3a, F3b, R2                       |
| K9  | 정상 종료는 내릴 것을 모두 내린 뒤 SHST를 완료로                                                   | D2   | F2a, F4b                           |

뒤 Work에서 K는 `carry: true`, 나눔은 `on_ask`나 `recall`로 둔다. 지식을 켠 쪽이 레포에 남긴 지식으로 이것을 다시 묻지 않고 지키면 PM1이 줄고 PM2가 오른다. 설계 문서 자체도 레포에 남으므로 두 쪽 모두 읽을 수 있다. 차이는 문서에 들어가지 않는 팀 규칙(K3, K5, K6, K8)과 다른 설계의 사실(K1, K2, K4, K7, K9)에서 난다.

`app/eval/knowledge-truth/40-ssd-campaign.json`에 연쇄가 끝난 뒤 레포에 남아야 할 지식(K1~K9와 R3의 차례)과 규칙이 아닌 것(예: "지금 GC 읽기 경고가 꺼져 있다"를 고칠 곳으로 적은 것)을 둬 `knowledge-quality.mjs`로 질을 본다.

## 4. 평가 도구에 더하는 것

| 더하는 것                                                         | 까닭                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Work마다 `type`, `expectedFiles`, `limits`                        | 한 연쇄에 설계·기능·리팩터·버그가 섞인다                                                                                                                                              |
| Work의 `merge: true`                                              | 같은 사람·같은 앱에서 앞 Work 브랜치를 main에 머지하고 시작한다(팀원 교대와 달리 새 clone이나 새 앱 저장소를 만들지 않음)                                                             |
| Work 여럿인 시나리오의 숨긴 쟁점 판정                             | 지금은 Work 하나짜리만 본다. 그 Work의 에이전트 세션 대화만 판정 모델에 준다                                                                                                          |
| 시나리오의 `repoTest`                                             | C 레포의 시험 명령(`make test`). 없으면 `npm test`                                                                                                                                    |
| Work마다 결과를 `progress.json`에 이어 씀                         | 한 실행이 몇 시간 걸린다. 중간에 도구가 멈춰도 끝낸 Work의 판정이 남는다                                                                                                              |
| `check-scenario.mjs`의 `merge` 처리                               | Work n마다 `reference-1..n-1`을 적용한 앞 상태(숨긴 시험 실패, guard 통과), `reference-1..n` 정답(모두 통과), `traps/<n>-*.patch` 함정(하나 이상 실패)을 본다. `--works a-b`로 일부만 |
| 숨긴 시험의 `timeoutMs`, `EVAL_BASE_DIR`, 시나리오의 `copyIgnore` | 마모 평준화 시험은 몇 분 걸린다. golden 시험은 기준 폴더를 견준다. 빌드 산출물(`host/build`)은 diff와 범위 판정에서 뺀다                                                              |

## 5. 돌리기와 비용

```bash
git clone -b relay-eval --filter=blob:none --sparse https://github.com/CheongMyungJ/Cosmos-plus-OpenSSD /tmp/cosmos-eval
git -C /tmp/cosmos-eval sparse-checkout set relay-eval   # 시나리오 팩만
bash app/eval/setup.sh
cd app
RELAY_EVAL_SCENARIOS=/tmp/cosmos-eval/relay-eval/scenarios node eval/check-scenario.mjs 40   # 이어 머지 확인, 1시간쯤
RELAY_EVAL_SCENARIOS=/tmp/cosmos-eval/relay-eval/scenarios node eval/run.mjs --scenarios 40 --arms relay,relay-off --runs 1 --parallel 2
```

- 시뮬레이터는 리눅스 전용이다(`mmap(MAP_FIXED)`, `prctl(PR_SET_PDEATHSIG)`). gcc와 make가 있어야 한다.
- 시간: Work 하나에 10~40분으로 보면 실행 하나(Work 21개)가 6~10시간이다. `--parallel 2`로 relay와 relay-off를 함께 돌린다.
- 회차: 연쇄가 길어 1회부터 시작한다. 1회로는 경향만 보고, 뒤 Work의 차이는 앞 Work 결과(에이전트가 다르게 구현함)에 따라 흔들린다. 그래서 Work마다 판정하고, 앞 Work가 숨긴 시험을 통과하지 못해 뒤 Work가 막힌 경우를 따로 센다.

## 6. 한계

- 실제 보드가 아니다. NSC 타이밍, DMA, 캐시 일관성은 시뮬레이터가 단순화한다. 시험은 FTL 논리만 본다.
- 앞 Work의 구현이 다르면 뒤 Work의 출발점이 달라진다. 두 쪽(relay, relay-off)은 서로 다른 코드 위에서 뒤 Work를 하게 되고, 이것은 연쇄 평가의 본래 성질이다.
- 사람 역할과 판정이 모두 Claude다(`docs/eval.md` 8절).
