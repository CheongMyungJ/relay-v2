# 요구사항 추출 run 평가

요구사항 추출 Work의 extract run 하나가 내는 결과의 품질을 재는 평가다. 설계의 근거는
[requirements-extraction-flow.md](requirements-extraction-flow.md) 17.1절(결정 16~23, 28)이고, 이 문서는 도구와
규약을 적는다. relay와 맨 CLI의 사용성을 견주는 [eval.md](eval.md)와 성격이 다르다: 사람 역할이 없고, run 하나를
지침 판(쪽)마다 돌려 정답 파일과 대조한다.

## 1. 구성

| 위치                                                                                                   | 내용                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skills/extract/run.mjs`, `load.mjs`                                                                   | 지시·결과 스키마 조립과 run 인자. 앱, `skills/check.mjs`, 하네스가 함께 쓴다(16.3)                                                                               |
| `skills/extract/contract.md`, `kinds/*.md`, `lenses/*.md`                                              | 지시 문구: L1 고정 계약, L2 종류 절차, 렌즈 카드(점검표와 trace 절. state·lifecycle·protocol은 점검표만, 결정 36, 70)                                            |
| `skills/extract/rules.mjs`, `counter/*.json`                                                           | 앱이 제출 때 보는 규칙 표와 규칙마다 반례(결정 71)                                                                                                               |
| `docs/contracts/extract-{survey,trace}.v0.schema.json`                                                 | 결과 스키마 v0(기본 스키마, 점검표 칸은 비어 있다)                                                                                                               |
| `app/eval/extract/run.mjs`                                                                             | 하네스: 쪽 하나를 시나리오·과제마다 회차만큼 돌린다                                                                                                              |
| `app/eval/extract/score.mjs`                                                                           | 채점: 결정론 채점과 판정 모델                                                                                                                                    |
| `app/eval/extract/report.mjs`                                                                          | 집계와 쪽 비교(bootstrap)                                                                                                                                        |
| `app/eval/extract/check-fixtures.mjs`                                                                  | 픽스처가 구성마다 컴파일되고 핵심 상수가 맞는지(clang 또는 zig cc)                                                                                               |
| `app/eval/extract/sides/<쪽>/`, `lib/sides.mjs`                                                        | 쪽의 지시 층. `base`는 최소 지시 판(결정 19), `v1`은 `skills/extract`의 지시 문구 그대로                                                                         |
| `app/eval/extract/scenarios/<id>/`                                                                     | `repo/`(손으로 쓴 펌웨어), `scenario.json`(과제, 빌드와 단정), `packets/`(손으로 쓴 패킷), `truth.json`(정답), `reference/`(만점 결과와 판정 답), `traps/`(함정) |
| `app/eval/seal.sh`, `unseal.sh`, `sealed/extract-h1.*`                                                 | 봉인 hold-out을 만들고 연다(7절)                                                                                                                                 |
| `app/eval/test/extract.test.mjs`                                                                       | 모델 없이 도는 시험: reference 만점, 함정 검출, 채점 규칙, 가짜 claude로 하네스 끝까지                                                                           |
| `app/test/contract/claude-run.ts`, `live-run.test.ts`, `fakes-run.test.ts`, `fixtures/claude-run.json` | run의 [계약]과 녹화본, 가짜 run(`test/support/fake-claude/print-run.mjs`)                                                                                        |

## 2. 시나리오

| id          | 내용                                                               | 구성                                     | 줄       |
| ----------- | ------------------------------------------------------------------ | ---------------------------------------- | -------- |
| e1-twoboard | bare-metal 온도 조절기, 호스트 UART 프로토콜, EEPROM 흉내          | alpha, beta(+ 빌드되지 않는 gamma)       | 약 1.6천 |
| e2-gateway  | picoRTOS 위 Modbus RTU 게이트웨이, ISR 넷, DMA 셋, SPI 플래시 로그 | basic, pro, devkit(+ 빌드되지 않는 lite) | 약 4.9천 |

과제는 시나리오마다 다섯이다: survey, trace-command, trace-timing, trace-variant, trace-shared(결정 18).

hold-out은 개발용과 다른 세션이 만들어 봉인했다(결정 22, AI 결정 64~68): `app/eval/sealed/extract-h1.tar.gz.enc`. 개발용과
같은 다섯 과제와 패킷 틀, 구성 둘, 약 4.5천 줄이고 16.6절 점검표 밖의 함정 범주를 하나 이상 넣었다. 내용과 범주는 이
레포에 적지 않는다(7절).

함정의 종류(정답 파일의 must_not, recall, resolvable): 구성 병합(`-D` 덮어쓰기, 강제 포함 헤더, 실행 중 등록),
근거 없는 수치·단위 확정(데이터시트에만 있는 LSI·타이머 클럭·바쁜 대기), 관찰값·문서 주장의 보장화, 숨은 두 번째
쓰기, 등록되지 않는 처리기와 죽은 코드, 주석·문서와 코드의 충돌, ISR와 태스크의 경쟁, DMA 소유권, 커널 호출 우선순위,
틱 버림과 ±1틱.

## 3. 돌리기

`app/`에서. 실제 claude를 부른다(구독 사용량이 든다).

```bash
node eval/extract/run.mjs --side base --label A --reps 5 --out eval/extract/results/<폴더>
node eval/extract/run.mjs --side base --label A2 --reps 5 --out eval/extract/results/<폴더>   # A/A
node eval/extract/score.mjs eval/extract/results/<폴더>
node eval/extract/report.mjs eval/extract/results/<폴더> --pair A,A2 --out 보고서.md
# 새 쪽을 기준선과 견주고 채택 규칙(5절)을 판정, run마다의 점수를 저장본으로 남김
node eval/extract/report.mjs eval/extract/results/<폴더> --pair B,N --adopt --out 보고서.md --runs-out 보고서.runs.json
# 저장한 기준선(git에 있음)을 함께 읽기
node eval/extract/report.mjs eval/extract/results/<폴더> --runs eval/extract/reports/2026-10-09-base-AA.runs.json --pair B,A --adopt
```

- 기본: 모델 sonnet, effort medium, 동시 2, 부드러운 마감 15분, 하드 상한 30분(결정 25, 30), 판정 sonnet.
- `--dry`는 가짜 claude로 하네스만 돈다(사용량 없음). `npm run test:eval`이 그 길을 지킨다.
- 이미 있는 run은 건너뛰고(사용량 한도로 버린 run은 다시 돈다), 판정은 입력 해시가 같으면 다시 부르지 않는다
  (`--redo`면 다시).
- 사용량(결정 28): run과 판정을 띄우기 전마다 `get_usage`로 주간 사용률을 보고 50%에 닿으면 멈춘다. `get_usage`가
  사용량을 주지 않으면 결과 폴더의 `calls.jsonl`로 실제 claude 호출을 150번까지로 묶는다(AI 결정 51).
  사용량 한도로 실패하면 5시간 창은 재설정 시각까지 기다렸다 같은 run부터 잇고, 주간이면 멈춘다(결정 29).
- `--always-cap`(run.mjs, score.mjs): `get_usage`가 사용량을 주지 않으면 run의 `rate_limit_event`가 사용률을 알려 줘도
  `--max-calls` 상한을 함께 건다(AI 결정 76). 여러 이름표를 한 결과 폴더에 두면 `calls.jsonl` 하나로 함께 센다.

run 하나의 조건: 시나리오 `repo/`를 고정한 작성자·시각으로 커밋한 기준 레포(같은 내용이면 같은 커밋 id),
cwd는 레포 밖 scratch, `--add-dir`로 레포, 쪽의 조립본(지시 파일과 argv 스키마), 표준 입력으로 패킷, 앱과 같은 훅
설정(+ worktree 쓰기 deny). 끝 판정은 15.3절: 종료 코드 0, 오류 아님, 구조화 출력이 조립한 스키마를 통과, 마지막
Stop에 백그라운드 작업 없음. worktree가 기준과 다르면 관문 위반이다.

## 4. 채점

결정론(결정 21):

- 앵커: code·doc_claim 앵커의 인용이 기준 커밋 파일의 그 줄 범위에 있는가(공백 정규화, Read 출력의 줄 번호 머리 제거,
  `...`로 나눈 조각은 차례로). 범위 밖에만 있으면 줄 어긋남, 파일 어디에도 없거나 파일이 없으면 지어낸 앵커.
- survey: 구성 이름(별칭), 인벤토리 이름의 토큰, 경계 경로, 확인되지 않아야 할 구성, 구성별로만 있는 항목의 구성
  병합, 어느 구성에도 없는 항목.
- trace: 수치를 symbol로 정답 수치에 잇고 값 글에서 (수, 단위) 후보를 모아 구성별 값과 견준다. 구성마다 다른 값을
  한 항목으로 합치면 병합, 맞는 값이 없으면 틀린 값, 코드로 유도할 수 없는 단위를 derived 시간 단위로 내면 근거 없는
  확정. 점검표의 해당 없음에는 검색 기록이 있어야 한다.
- 누출 카나리(정답 파일에만 있는 문자열)가 출력에 있으면 관문 위반.

판정 모델(sonnet, effort high, 도구·MCP·사용자 설정·세션 저장 없음): 결과를 `<절> <key>: <글>` 줄로 보이고 결정론이 가르지 않는
recall·must_not·resolvable 항목마다 found/violated/left_unknown과 근거 key를 받는다. 통과 규칙은 코드다: 가리킨 key가
결과에 있어야 인정한다(절 이름을 붙인 key는 마지막 낱말로 읽는다). 판정 모델이 유보(hedged)라고 본 금지 주장은 세지 않는다, 답이 없는 recall은 판정 불가로 분모에서 뺀다.

지표(결정 23):

| 지표                    | 정의                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| PM-A 잘못된 확정 수     | run 하나에서 위반한 must_not id 수(결정론과 판정의 합집합) + 수치 오류. 낮을수록 좋다                      |
| PM-B 알려진 항목 재현율 | 그 과제의 recall 항목 가운데 찾은 비율. 높을수록 좋다                                                      |
| 관문                    | 누출 카나리, worktree 변경. 0이어야 한다                                                                   |
| 보조                    | 실패율, 지어낸 앵커 비율, 줄 어긋남 비율, 소극화(resolvable을 미확정으로 둔 수), 비용, 시간, 턴, 마감 도달 |

실패한 run은 주지표에서 빼고 실패율로 따로 센다(AI 결정 53). 쪽 비교는 시나리오·과제를 층으로 둔 bootstrap
95% 구간(10,000번, 고정 씨앗, `eval/primary.mjs`의 `compare`)이다.

## 5. 채택 기준

결정 23의 모양에 기준선과 A/A로 정한 숫자(결정 62)를 넣었다. 새 쪽 B를 base와 견줄 때:

- 관문(누출 카나리, worktree 변경)이 0이고, 실패율이 base보다 10%p 넘게 높지 않다.
- 그리고 둘 가운데 하나: PM-A 차이(B − base)의 95% 구간 상한 < 0이고 PM-B 차이의 하한 ≥ −0.03, 또는 PM-B 차이의 하한 > 0이고 PM-A 차이의 상한 ≤ +0.25.
- 채택한 판은 봉인 hold-out에서 같은 규칙으로 한 번 확인한다.

판정은 `report.mjs --pair 새,기준 --adopt`가 코드로 한다(AI 결정 75). 2026-10-09 6차 작업에서 첫 지침 판(v1)과 한 번 고친 판은
모두 채택하지 않았다(재현율 퇴보, requirements-extraction-flow.md 17.6절).

근거: A/A의 차이가 PM-A 0.10 [−0.02, 0.22], PM-B 0.005 [−0.011, 0.020]였다(2026-10-09, `app/eval/extract/reports/2026-10-09-base-AA.md`). 기준선은 PM-A 0.25/run, PM-B 0.965이고 e1은 천장에 가깝다(개선은 주로 e2에서 갈린다).

판정 모델은 사람 대신 손으로 표본 확인했고(결정 60) 금지 주장마다 인용과 유보 여부를 받는다. 판정 규칙이나 정답 글을 고치면 두 쪽을 함께 다시 판정한다(입력 해시가 바뀌면 `score.mjs`가 다시 부른다).

## 6. 시험

- `npm run test:eval`(모델 없음): `eval/test/extract.test.mjs`와 `check-fixtures.mjs`(컴파일러가 없으면 건너뜀).
  시나리오마다 reference가 스키마를 통과하고 만점이며, 함정마다 해당 지표에서 reference보다 나빠야 한다.
- 채점 규칙을 고치면 이 시험에 경우를 더한다(CLAUDE.md). 실제 run에서 본 값 글은 회귀 시험으로 남긴다.
- 정답을 고치면 `reference/`와 `traps/`가 여전히 만점·검출인지 본다. 픽스처를 고치면 `check-fixtures.mjs`를 돌린다.

## 7. 봉인 hold-out

지침 판을 고른 뒤 같은 채택 규칙으로 한 번 확인하는 데만 쓴다(결정 62). 지침을 쓰거나 재는 세션은 열지도 보지도 않는다.

| 이름(`sealed/<이름>.tar.gz.enc`) | 내용                                            | 푼 뒤의 자리                      |
| -------------------------------- | ----------------------------------------------- | --------------------------------- |
| `holdout`                        | 지식 실험의 hold-out(E9에서 풀어 소진)          | `eval/scenarios/`, `eval/guides/` |
| `extract-h1`                     | 요구사항 추출 run 평가의 hold-out 시나리오 하나 | `eval/extract/scenarios/`         |

푸는 법(`app/`에서, 열쇠는 사람이 확인을 시킬 때 준다):

```bash
HOLDOUT_KEY='<열쇠>' bash eval/unseal.sh extract-h1
node eval/extract/check-fixtures.mjs        # 풀린 시나리오도 컴파일되는지
npm run test:eval                            # reference 만점, 함정 검출
node eval/extract/run.mjs --side <쪽> --label H --reps 5 --scenarios <푼 시나리오 id> --out eval/extract/results/<폴더>
```

- `unseal.sh`는 암호문과 푼 묶음의 해시(`sealed/<이름>.SHA256SUMS`, `<이름>.PLAIN.SHA256SUMS`)를 확인하고 `eval/` 아래 제자리에
  꺼낸다. 열쇠가 틀리면 풀지 않는다. 이름을 빼면 `holdout`이다.
- 푼 시나리오는 `listScenarios()`에 잡혀 하네스·시험이 그대로 쓴다. 평문은 커밋하지 않는다: `app/.gitignore`가
  `eval/extract/scenarios/h[0-9]*/`를 뺀다(hold-out 시나리오 id는 `h`와 숫자로 시작한다).
- 시나리오 폴더의 `make-fixtures.py`가 정답·패킷·reference·함정을 만든다. 픽스처를 고치면 다시 돌리고(줄 번호가 따라온다)
  다시 봉인한다.

봉인하는 법(만든 세션이 시나리오를 확인한 뒤 한 번):

```bash
HOLDOUT_KEY='<열쇠>' bash eval/seal.sh <이름> extract/scenarios/<시나리오 id>
```

- 경로는 `eval/` 기준이다. 이름순·고정 시각·고정 소유자로 묶어(같은 내용이면 같은 묶음) `unseal.sh`와 같은 매개변수
  (AES-256-CBC, PBKDF2 200,000번, SHA-256)로 암호화하고, 두 해시 파일을 쓴 뒤 같은 열쇠로 풀어 원본과 같은지 본다. git에
  들어 있는 경로는 봉인하지 않는다(평문이 남는다).
- 열쇠는 무작위 256비트(`openssl rand -hex 32`)로 만들어 사람에게만 알린다. 레포, 문서, 커밋 메시지, 결과 폴더에 남기지
  않는다.
- 봉인한 뒤 평문 폴더를 지우거나 레포 밖으로 옮기고, `unseal.sh`로 풀어 원본과 같은지와 `check-fixtures.mjs`,
  `npm run test:eval`이 통과하는지 확인한다.
