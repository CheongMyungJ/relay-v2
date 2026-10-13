# SSD 펌웨어 연속 평가 (Cosmos+ OpenSSD)

- 상태: 시나리오 목록 확정, 호스트 시뮬레이터와 평가 도구 확장 끝, 시나리오 팩 작성 중 (2026-10-13)
- 대상: [Cosmos+ OpenSSD](https://github.com/Cosmos-OpenSSD/Cosmos-plus-OpenSSD)의 `GreedyFTL-3.0.0` 펌웨어 (C, GPLv3)
- 시나리오 팩: 포크 `CheongMyungJ/Cosmos-plus-OpenSSD`의 `relay-eval` 브랜치 `relay-eval/scenarios/`. GPL 코드라 이 레포(MIT)에는 넣지 않고 `RELAY_EVAL_SCENARIOS`로 가리킨다 (`docs/eval.md` 7절)

## 1. 목적

`docs/eval.md`의 시나리오는 작은 JS 레포에서 Work 한두 개를 돈다. 여기서는 두 가지를 본다.

1. **낯선 큰 C 코드에서 relay로 설계 → 구현 → 정리 → 버그 수정을 이어 갈 수 있는지.** 설계 5건, 그 설계를 구현하는 기능 추가 10건, 리팩터링 3건, 버그 수정 3건을 한 레포에서 차례로 한다.
2. **지식이 쌓여 뒤 Work를 돕는지.** Work를 끝낼 때마다 도구가 그 브랜치를 main에 머지한다(PR 머지 흉내). 사람이 앞 Work에서 알려 준 팀 규칙과 도메인 사실이 뒤 Work에서 다시 필요하도록 짰다. 지식을 켠 relay와 끈 relay(`relay-off`)를 같은 연쇄로 돌려, 뒤 Work의 다시 알려 줌(PM1), 숨긴 시험(PM2), 질문 수, 사람 차례를 견준다(`docs/knowledge-experiment/protocol.md` 4절의 지표).

## 2. 시험할 수 있게 만든 것

펌웨어는 Zynq 보드의 NAND 제어기(NSC)와 NVMe 호스트 DMA 레지스터를 직접 만진다. 기준 레포에 호스트 시뮬레이터를 둬서 PC에서 빌드하고 돌린다.

| 부분 | 내용 |
|---|---|
| `firmware/` | GreedyFTL-3.0.0 그대로. 바꾼 것은 `ftl_config.h`의 기하 상수를 `#ifndef`로 감싼 것뿐(시뮬레이터가 작은 기하로 빌드) |
| `host/sim/` | NSC 레지스터 함수(`V2F*`)를 흉내 내는 NAND 모델(페이지·spare 저장, 프로그램·지우기·읽기 실패와 비트 오류 주입, 전원 차단), NVMe 호스트 쪽 함수(`host_lld`)를 흉내 내는 명령 제출·DMA·완료 큐, Xilinx 헤더 대역 |
| `host/tests/` | 기준 시험. `make test`로 돈다 |
| 메모리 | 펌웨어는 `0x10000000` 같은 고정 DRAM 주소를 32비트 정수로 다룬다. 시뮬레이터는 64비트 리눅스에서 그 주소 범위를 `mmap(MAP_FIXED)`로 잡고 `-no-pie`로 빌드해 펌웨어 코드를 고치지 않는다 |

숨긴 시험은 NVMe 명령 수준(명령 dword와 데이터를 넣고 완료 상태와 데이터를 봄)과 NAND 모델의 관찰(어느 페이지에 무엇이 쓰였나, spare 바이트, 지우기 횟수)로만 본다. 앞 Work에서 에이전트가 어떤 함수 이름으로 구현했든 뒤 Work의 시험이 컴파일되게 하려는 것이다. 숨긴 시험은 JS 감싸개(`node --test`)가 레포의 `firmware/**/*.c`와 `host/sim/*.c`를 모아 시험 C 파일과 함께 빌드해 돌린다.

시뮬레이터 기하: 2채널 × 2웨이(다이 4), LUN 2, LUN당 블록 32(+예비 4), 블록당 페이지 16, 페이지 16KiB(슬라이스 1개 = NVMe 블록 4개). 사용자 용량 약 40MiB.

### 2.1 시뮬레이터로 확인한 원래 펌웨어의 사실

시나리오를 짤 때 시뮬레이터로 확인했다(2026-10-13).

- B1: 쓰지 않은 LBA를 읽으면 버퍼에 남은 다른 LBA의 데이터가 나온다. 부분 슬라이스 쓰기도 그 버퍼로 읽기-수정-쓰기를 해 다른 LBA 데이터가 섞인다
- B2: 이름공간 끝에 걸친 쓰기가 성공으로 끝나고(끝 밖 LBA까지 씀), 끝 밖에서 시작하는 쓰기는 `ASSERT`로 펌웨어가 멈춘다
- B3: 위 부하에서 `FindFreeVirtualSliceForGc`의 "There is no available block" assert로 펌웨어가 죽는다. GC가 현재 블록을 희생으로 골랐을 때 새 현재 블록을 잡으면 사라진다
- 부팅할 때마다 사용자 블록을 모두 지운다(`InitBlockDieMap`의 `EraseUserBlockSpace`). 그래서 지금은 전원을 껐다 켜면 데이터가 남지 않는다. Flush 명령은 아무것도 하지 않고 완료하고, 정상 종료도 더러운 버퍼를 내리지 않는다. D2가 이것을 다룬다

## 3. 연쇄 (Work 21개)

한 실행이 같은 레포에서 Work 1부터 21까지 차례로 한다. 모든 Work 앞에서 도구가 앞 Work 브랜치를 main에 머지한다(`merge: true`, 4절). 사람은 한 사람이고 Work마다 사람 역할 세션은 새로 둔다(같은 사람이 그 Work의 사정만 받음, 앞 Work에서 알려 준 것은 `carry`로 "물으면 답함").

| # | 유형 | 이름 | 요청 (사람이 하는 말, 요약) |
|---|---|---|---|
| 1 | 버그 | B1 빈 영역 읽기 | "새로 포맷한 디스크에서 아직 안 쓴 LBA를 읽었더니 다른 파일 내용이 보인다" |
| 2 | 버그 | B2 끝 넘는 쓰기 | "디스크 끝에 걸친 쓰기가 성공으로 끝나고 가끔 펌웨어가 멈춘다" |
| 3 | 설계 | D1 TRIM | Dataset Management(deallocate) 지원 설계를 `docs/design/trim.md`에 |
| 4 | 기능 | F1a TRIM 기본 | D1대로 슬라이스 전체 범위의 deallocate |
| 5 | 기능 | F1b TRIM 경계 | D1대로 부분 슬라이스, 범위 검사, Identify 광고 |
| 6 | 설계 | D2 전원 손실 복구 | 페이지 spare에 논리 주소·순번을 남기고 부팅 때 맵을 다시 세우는 설계를 `docs/design/power-loss.md`에 |
| 7 | 기능 | F2a spare 메타와 Flush | D2대로 모든 프로그램(GC 복사 포함)에 메타를 쓰고, Flush가 버퍼를 NAND에 내림 |
| 8 | 기능 | F2b 부팅 복구 | D2대로 전원 차단 뒤 스캔으로 맵 복구 |
| 9 | 리팩터 | R1 요청 채우기 | 흩어진 `reqPool[...]` 채우기를 함수로 모음 |
| 10 | 설계 | D3 마모 평준화 | 지우기 횟수로 빈 블록 고르기와 정적 마모 평준화 설계를 `docs/design/wear-leveling.md`에 |
| 11 | 기능 | F3a 빈 블록 고르기 | D3대로 지우기 횟수가 가장 적은 빈 블록 |
| 12 | 기능 | F3b 정적 평준화 | D3대로 차이가 문턱을 넘으면 차가운 블록 옮기기 |
| 13 | 버그 | B3 GC 이중 할당 | "가득 찬 디스크에서 작은 영역을 계속 덮어쓰다 다른 데이터도 쓰면 펌웨어가 'There is no available block'으로 멈춘다" |
| 14 | 설계 | D4 매체 오류 | 읽기 실패·프로그램 실패·그로운 배드 블록 처리 설계를 `docs/design/media-errors.md`에 |
| 15 | 기능 | F4a 읽기 오류 보고 | D4대로 고칠 수 없는 읽기는 NVMe 오류 상태로 |
| 16 | 기능 | F4b 블록 은퇴 | D4대로 프로그램 실패 블록을 은퇴시키고 데이터를 잃지 않음 |
| 17 | 리팩터 | R2 리스트 통합 | 빈 블록 리스트와 GC 희생 리스트의 같은 연결 리스트 코드를 하나로 |
| 18 | 설계 | D5 SMART | Get Log Page(02h) 건강 정보 설계를 `docs/design/smart.md`에 |
| 19 | 기능 | F5a SMART 값 | D5대로 카운터와 로그 페이지 |
| 20 | 기능 | F5b SMART 유지 | D5대로 전원 주기를 넘어 카운터 유지, 비정상 종료 횟수 |
| 21 | 리팩터 | R3 스케줄러 나누기 | 974줄짜리 `request_schedule.c`의 채널별 스케줄링을 상태별 함수로 |

설계 Work는 코드를 바꾸지 않는다(범위 guard). 기능 Work의 요청은 설계 문서 경로와 바깥에서 부를 이름(NVMe 명령, 로그 페이지)만 말하고, 세부는 머지된 설계 문서와 사람에게서 온다.

### 3.1 Work마다 사람만 아는 것과 숨긴 시험

`K`는 여러 Work에 걸치는 지식(3.2), 괄호는 첫 Work에서의 나눔 방식(upfront 처음부터 말함 / on_ask 물으면 답함 / recall 짚어 주면 떠오름)이다.

| # | 사람만 아는 것 | 숨긴 시험 (guard는 기준에서도 통과) |
|---|---|---|
| B1 | K1 쓰지 않은 LBA는 0을 읽어야 한다(on_ask). 원인은 두 곳: 읽기 미스에서 매핑이 없으면 버퍼를 안 지움, 부분 슬라이스 쓰기의 읽기-수정-쓰기도 같은 버퍼를 씀(recall: "512바이트 단위로 쓰는 앱도 있다") | 빈 LBA 읽기 0 / 부분 슬라이스 쓰기 뒤 나머지 0 / 기존 읽기·쓰기(guard) |
| B2 | K2 범위 밖은 상태 LBA Out of Range(SCT 0, SC 80h), 한 블록도 쓰지 않는다(on_ask). K3 펌웨어에 동적 할당 금지(upfront) | 끝 걸친 쓰기 80h, 아무것도 안 바뀜 / 끝 블록까지 쓰기 성공(guard) / `malloc` 안 씀(guard) |
| D1 | K1(carry) / 부분 슬라이스는 그 LBA를 0으로 채워 쓴다(on_ask) / deallocate한 슬라이스의 더러운 버퍼는 버린다(recall) / 범위 오류는 K2(carry) | 쟁점 4개(물었고 문서에 반영) / 코드 안 바뀜(scope guard) |
| F1a | 설계 문서 / K1 | 전체 슬라이스 deallocate 뒤 0 / 더러운 버퍼가 다시 살아나지 않음 / GC가 deallocate된 슬라이스를 복사하지 않음 / K3(guard) |
| F1b | 설계 문서 / K2 | 부분 슬라이스 0 / 범위 오류 80h·아무것도 안 바뀜 / Identify ONCS.DSM, NSFEAT·DLFEAT / K3(guard) |
| D2 | K4 온플래시 형식에는 매직·버전·CRC32를 둔다(on_ask) / K5 spare 첫 바이트(공장 배드 마크 자리)는 0xFF로 둔다(recall) / 같은 LBA는 순번이 큰 것이 이긴다 / deallocate도 전원 손실 뒤 유지(K1 carry, recall) | 쟁점 4개 / scope guard |
| F2a | 설계 문서 / K5 / K4 | 모든 프로그램에 LBA·순번 / GC 복사도 / Flush 뒤 더러운 버퍼 없음 / K5 / K3(guard) |
| F2b | 설계 문서 / K1·K4 carry | 전원 차단 뒤 데이터 / 같은 LBA 최신 / deallocate가 되살아나지 않음 / 깨진 spare(CRC)는 버림 / K5(guard) |
| R1 | K6 GC 읽기는 ECC 경고를 끈다, 일부러 다르다(recall) | NAND 명령 기록이 기준과 같음(golden trace, guard) / GC 읽기 경고 꺼짐 / K3(guard) |
| D3 | K7 정격 P/E는 3000회(on_ask) / K8 같으면 블록 번호 작은 것(결정적, 재현 때문, on_ask) / 문턱 차이 100, 한 번에 블록 하나(on_ask) / 옮기는 쓰기도 K5·D2 메타 규칙(carry, recall) | 쟁점 4개 / scope guard |
| F3a | 설계 문서 / K8 | 가장 적게 지운 블록 / 같으면 작은 번호 / K3(guard) |
| F3b | 설계 문서 / K5 carry | 문턱에서 이동 / 한 번에 하나 / 옮긴 데이터 읽힘 / 옮긴 페이지 메타(D2) / K5(guard) |
| B3 | 재현 부하만 앎(upfront). 원인: 쓰기 중인 현재 블록이 모두 무효가 된 순간 빈 블록이 모자라면 GC가 그 블록을 희생으로 지워 빈 리스트에 넣고도 현재 블록으로 계속 씀(같은 블록이 빈 리스트와 현재 블록에 함께 있음) | 재현 부하에서 멈추지 않고 데이터 그대로 / 기존 GC(guard) |
| D4 | 고칠 수 없는 읽기는 Unrecovered Read Error(SCT 2, SC 81h)(on_ask) / 재시도 뒤에만(on_ask) / K2 carry(잘못된 요청과 매체 오류를 섞지 않음) / BBT는 K4 형식(carry, recall) | 쟁점 4개 / scope guard |
| F4a | 설계 문서 | 81h / 재시도로 고쳐지면 성공 / 다른 LBA 영향 없음 / K3(guard) |
| F4b | 설계 문서 / K4·K5 carry | 프로그램 실패 블록 은퇴 / 데이터 잃지 않음 / 은퇴가 전원 주기 뒤 유지 / K5(guard) |
| R2 | K8 carry: 같은 무효 수면 오래된(FIFO) 블록부터, 바꾸면 시험 재현이 깨진다(recall) | golden trace(guard) / 희생 블록 차례 / K3(guard) |
| D5 | Data Units는 512바이트×1000 단위로 올림(on_ask) / Percentage Used는 평균 지우기 횟수 ÷ K7(carry) / Available Spare는 예비 블록 기준(on_ask) / 범위 밖 로그 요청은 K2와 같은 원칙(carry) | 쟁점 4개 / scope guard |
| F5a | 설계 문서 / K7 carry | 카운터 값 / Percentage Used / Media Errors(F4a와 이어짐) / K3(guard) |
| F5b | 설계 문서 / K4 carry | 전원 주기 뒤 유지 / 비정상 종료 횟수 / 깨진 기록 버림 / K5(guard) |
| R3 | 읽기 트리거가 쓰기보다 먼저인 차례는 지연 요구라 유지(recall) | golden trace(guard) / 차례 / K3(guard) |

### 3.2 여러 Work에 걸치는 지식

| K | 지식 | 처음 | 다시 필요한 Work |
|---|---|---|---|
| K1 | 쓰지 않거나 deallocate한 LBA는 0을 읽는다(전원 손실 뒤에도) | B1 | D1, F1a, D2, F2b |
| K2 | 잘못된 범위는 LBA Out of Range(80h), 일부만 처리하지 않는다 | B2 | D1, F1b, D4, D5 |
| K3 | 펌웨어 코드에 동적 할당 금지. 새 표는 `memory_map.h`에 영역을 두고 `CheckConfigRestriction`에 검사 | B2 | 모든 기능·리팩터 Work의 guard |
| K4 | 온플래시 형식에는 매직·버전·CRC32 | D2 | F2a, F2b, D4, F4b, F5b |
| K5 | spare 첫 바이트(공장 배드 마크 자리)는 0xFF | D2 | F2a, D3, F3b, F4b, 이후 guard |
| K6 | GC 읽기는 ECC 경고를 끈다(일부러 다름) | R1 | D4 |
| K7 | 정격 P/E 3000회 | D3 | D5, F5a |
| K8 | 같은 조건이면 결정적으로: 작은 번호, 오래된 것 먼저 | D3 | F3a, R2 |

뒤 Work에서 K는 `carry: true`, 나눔은 `on_ask`나 `recall`로 둔다. 지식을 켠 쪽이 레포에 남긴 지식으로 이것을 다시 묻지 않고 지키면 PM1이 줄고 PM2가 오른다. 설계 문서 자체도 레포에 남으므로 두 쪽 모두 읽을 수 있다. 차이는 문서에 들어가지 않는 팀 규칙(K3, K5, K6, K8)과 다른 설계의 사실(K1, K2, K4, K7)에서 난다.

`knowledge-truth/40-ssd-campaign.json`에 연쇄가 끝난 뒤 레포에 남아야 할 지식(K1~K8)과 규칙이 아닌 것(예: "지금 GC 읽기 경고가 꺼져 있다"를 고칠 곳으로 적은 것)을 둬 `knowledge-quality.mjs`로 질을 본다.

## 4. 평가 도구에 더하는 것

| 더하는 것 | 까닭 |
|---|---|
| Work마다 `type`, `expectedFiles`, `limits` | 한 연쇄에 설계·기능·리팩터·버그가 섞인다 |
| Work의 `merge: true` | 같은 사람·같은 앱에서 앞 Work 브랜치를 main에 머지하고 시작한다(팀원 교대와 달리 새 clone이나 새 앱 저장소를 만들지 않음) |
| Work 여럿인 시나리오의 숨긴 쟁점 판정 | 지금은 Work 하나짜리만 본다. 그 Work의 에이전트 세션 대화만 판정 모델에 준다 |
| 시나리오의 `repoTest` | C 레포의 시험 명령(`make test`). 없으면 `npm test` |
| Work마다 결과를 `progress.json`에 이어 씀 | 한 실행이 몇 시간 걸린다. 중간에 도구가 멈춰도 끝낸 Work의 판정이 남는다 |
| `check-scenario.mjs`의 `merge` 처리 | merge Work는 팀원 교대처럼 `reference-1..n`을 차례로 적용해 확인한다 |

## 5. 돌리기와 비용

```bash
git clone -b relay-eval https://github.com/CheongMyungJ/Cosmos-plus-OpenSSD /tmp/cosmos-eval   # 시나리오 팩
bash app/eval/setup.sh
cd app
RELAY_EVAL_SCENARIOS=/tmp/cosmos-eval/relay-eval/scenarios node eval/check-scenario.mjs all
RELAY_EVAL_SCENARIOS=/tmp/cosmos-eval/relay-eval/scenarios node eval/run.mjs --scenarios 40 --arms relay,relay-off --runs 1 --parallel 2
```

- 시간: Work 하나에 10~40분으로 보면 실행 하나(Work 21개)가 6~10시간이다. `--parallel 2`로 relay와 relay-off를 함께 돌린다.
- 회차: 연쇄가 길어 1회부터 시작한다. 1회로는 경향만 보고, 뒤 Work의 차이는 앞 Work 결과(에이전트가 다르게 구현함)에 따라 흔들린다. 그래서 Work마다 판정하고, 앞 Work가 숨긴 시험을 통과하지 못해 뒤 Work가 막힌 경우를 따로 센다.

## 6. 한계

- 실제 보드가 아니다. NSC 타이밍, DMA, 캐시 일관성은 시뮬레이터가 단순화한다. 시험은 FTL 논리만 본다.
- 앞 Work의 구현이 다르면 뒤 Work의 출발점이 달라진다. 두 쪽(relay, relay-off)은 서로 다른 코드 위에서 뒤 Work를 하게 되고, 이것은 연쇄 평가의 본래 성질이다.
- 사람 역할과 판정이 모두 Claude다(`docs/eval.md` 8절).
