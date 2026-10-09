# 요구사항 추출 run 평가

요구사항 추출 Work의 extract run 하나가 내는 결과의 품질을 재는 평가다. 설계의 근거는
[requirements-extraction-flow.md](requirements-extraction-flow.md) 17.1절(결정 16~23, 28)과 integrate·review·summarize를
더한 AI 결정 127이고, 이 문서는 도구와 규약을 적는다. relay와 맨 CLI의 사용성을 견주는 [eval.md](eval.md)와 성격이
다르다: 사람 역할이 없고, run 하나를 지침 판(쪽)마다 돌려 정답 파일과 대조한다.

## 1. 구성

| 위치                                                                                                         | 내용                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skills/extract/run.mjs`, `load.mjs`                                                                         | 지시·결과 스키마 조립과 run 인자. 앱, `skills/check.mjs`, 하네스가 함께 쓴다(16.3)                                                                               |
| `skills/extract/contract.md`, `kinds/*.md`, `lenses/*.md`                                                    | 지시 문구: L1 고정 계약, L2 종류 절차, 렌즈 카드(점검표와 trace 절. state·lifecycle·protocol은 점검표만, 결정 36, 70)                                            |
| `skills/extract/rules.mjs`, `counter/*.json`                                                                 | 앱이 제출 때 보는 규칙 표와 규칙마다 반례(결정 71)                                                                                                               |
| `docs/contracts/extract-{survey,trace,integrate,review,summarize}.v0.schema.json`                            | 결과 스키마 v0(기본 스키마. 점검표·coverage·answers·verdicts 칸은 비어 있고 run마다 키를 채운다, 결정 36)                                                        |
| `skills/extract/packets.mjs`, `review.mjs`, `perspectives.md`                                                | integrate·review·summarize의 패킷과 기록 목록, review의 맹검 질문, integrate의 관점. 앱과 하네스가 함께 쓴다(AI 결정 109, 112)                                   |
| `app/eval/extract/run.mjs`                                                                                   | 하네스: 쪽 하나를 시나리오·과제마다 회차만큼 돌린다                                                                                                              |
| `app/eval/extract/lib/tasks.mjs`                                                                             | 과제의 run 입력: 손으로 쓴 패킷의 자리표시, 기록으로 만든 패킷과 기록 목록, 결과 스키마 칸의 키                                                                  |
| `app/eval/extract/score.mjs`                                                                                 | 채점: 결정론 채점과 판정 모델                                                                                                                                    |
| `app/eval/extract/report.mjs`                                                                                | 집계와 쪽 비교(bootstrap)                                                                                                                                        |
| `app/eval/extract/check-fixtures.mjs`                                                                        | 픽스처가 구성마다 컴파일되고 핵심 상수가 맞는지(clang 또는 zig cc)                                                                                               |
| `skills/extract/build-index.mjs`, `app/eval/extract/lib/build-index.mjs`, `app/eval/extract/build-index.mjs` | 구성별 빌드 인덱스(정의된 심볼, 전처리 뒤 살아 있는 줄)와 제출 검사 규칙 `config_active`(AI 결정 87·88). 컴파일러 찾기와 인자는 `lib/cc.mjs`                     |
| `app/eval/extract/sides/<쪽>/`, `lib/sides.mjs`                                                              | 쪽의 지시 층. `base`는 최소 지시 판(결정 19), `v1`은 `skills/extract`의 지시 문구 그대로                                                                         |
| `app/eval/extract/scenarios/<id>/`                                                                           | `repo/`(손으로 쓴 펌웨어), `scenario.json`(과제, 빌드와 단정), `packets/`(손으로 쓴 패킷), `truth.json`(정답), `reference/`(만점 결과와 판정 답), `traps/`(함정) |
| `app/eval/extract/scenarios/<id>/records/`                                                                   | integrate·review·summarize의 손으로 쓴 기록(2절)                                                                                                                 |
| `app/eval/seal.sh`, `unseal.sh`, `sealed/extract-h1.*`, `sealed/extract-h2.*`                                | 봉인 hold-out을 만들고 연다(7절)                                                                                                                                 |
| `app/eval/test/extract.test.mjs`                                                                             | 모델 없이 도는 시험: reference 만점, 함정 검출, 채점 규칙, 가짜 claude로 하네스 끝까지                                                                           |
| `app/test/contract/claude-run.ts`, `live-run.test.ts`, `fakes-run.test.ts`, `fixtures/claude-run.json`       | run의 [계약]과 녹화본, 가짜 run(`test/support/fake-claude/print-run.mjs`)                                                                                        |

## 2. 시나리오

| id          | 내용                                                               | 구성                                     | 줄       |
| ----------- | ------------------------------------------------------------------ | ---------------------------------------- | -------- |
| e1-twoboard | bare-metal 온도 조절기, 호스트 UART 프로토콜, EEPROM 흉내          | alpha, beta(+ 빌드되지 않는 gamma)       | 약 1.6천 |
| e2-gateway  | picoRTOS 위 Modbus RTU 게이트웨이, ISR 넷, DMA 셋, SPI 플래시 로그 | basic, pro, devkit(+ 빌드되지 않는 lite) | 약 4.9천 |

과제는 시나리오마다 여덟이다: survey, trace-command, trace-timing, trace-variant, trace-shared(결정 18)와 integrate, review,
summarize(AI 결정 127).

integrate·review·summarize는 앞선 run들의 기록을 입력으로 받는다. 기록은 시나리오의 `records/<과제>.json`이다:
`skills/extract/packets.mjs` 머리말의 기록 꼴에 `intent`를 더하고, integrate는 `since`(지난 integrate 뒤의 run id, 없으면 모두
새것), review는 `batch`(검토할 주장 id, 차례대로)를 둔다. 그 시나리오의 survey·trace reference 결과를 앱의 반영과 같은 꼴(주장
`c-NNNN`, 단위 `u-NNNN`, 근거 `e-NNNN`, 앵커는 근거 id로)로 옮긴 뒤 연결·빈칸·틀린 주장을 심었다. 패킷은 run 때 앱과 같은
`packets.mjs`로 만든다(AI 결정 109). 개발용 두 시나리오에 심은 것:

| 과제      | 심은 것                                                                                                                                                                                                                                                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| integrate | 앞 단위의 미확정을 뒤 trace가 푼다(resolves). 데이터시트·레퍼런스 매뉴얼이 있어야 하는 미확정과 그 주석을 되풀이한 뒤 주장(풀면 안 됨). 같은 구성의 같은 말(merges). 글은 같고 구성이 다른 두 주장(합치면 안 됨). 같은 단위를 이어 돈 run이 다시 본 수치(supersedes). 함께 설 수 없는 두 주장(conflicts). 어느 단위도 닿지 않은 진입점(coverage unreached와 제안 단위) |
| review    | 위험 등급 차례의 묶음 여덟(질문 셋, 서술 다섯): 틀린 값의 수치, 구성 목록이 틀린 인벤토리, 다른 쓰기가 있는 부재 주장, "모든 구성"을 과장한 관찰. 반박하면 안 되는 맞는 부재 주장, 동시성 제약, 요구 후보                                                                                                                                                              |
| summarize | run 상한에서 멈춘 부분 분석(보류된 단위 둘), 검토가 내린 주장 넷, 열린 미확정, 답 후보가 있는 미확정, 충돌과 충돌 연결, coverage 빈칸                                                                                                                                                                                                                                  |

기록과 기록으로 만든 패킷에는 정답 글과 카나리가 없고, 기록의 근거는 기준 커밋의 줄과 맞는다(시험이 본다).

hold-out은 개발용과 다른 세션이 만들어 봉인했다(결정 22, AI 결정 64~68): `app/eval/sealed/extract-h1.tar.gz.enc`. 개발용과
같은 다섯 과제와 패킷 틀, 구성 둘, 약 4.5천 줄이고 16.6절 점검표 밖의 함정 범주를 하나 이상 넣었다. 내용과 범주는 이
레포에 적지 않는다(7절). 9차 작업에서 v3 확인에 한 번 써서 소진했다(17.9절). 14차 작업에서 다른 하위 에이전트가 새 hold-out
`extract-h2`를 만들어 봉인했고(AI 결정 105) 같은 다섯 과제로 v4를 확인하는 데 한 번 써서 소진했다(17.13절, AI 결정 106).
다음 판의 확인에는 새 hold-out이 필요하다.

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
# 지시 바이트가 같은 층의 run을 고친 판의 이름표로 묶기(시나리오.과제 단위)
node eval/extract/report.mjs eval/extract/results/<폴더> --as C=C2@e1-twoboard.trace-timing --pair C2,N --adopt
# integrate·review·summarize(AI 결정 127): 두 쪽을 같은 때에 한 폴더로 돌리고 그 6층만 판정
node eval/extract/run.mjs --side base --label B --reps 5 --kinds integrate,review,summarize --always-cap --out eval/extract/results/<폴더>
node eval/extract/run.mjs --side v1 --label N --reps 5 --kinds integrate,review,summarize --always-cap --out eval/extract/results/<폴더>
node eval/extract/score.mjs eval/extract/results/<폴더> --always-cap
node eval/extract/report.mjs eval/extract/results/<폴더> --tasks integrate,review,summarize --pair N,B --adopt --out 보고서.md --runs-out 보고서.runs.json
```

- 기본: 모델 sonnet, effort medium, 동시 2, 부드러운 마감 15분, 하드 상한 30분(결정 25, 30), 판정 sonnet.
- `--dry`는 가짜 claude로 하네스만 돈다(사용량 없음). `npm run test:eval`이 그 길을 지킨다.
- 이미 있는 run은 건너뛰고(사용량 한도로 버린 run은 다시 돈다), 판정은 입력 해시가 같으면 다시 부르지 않는다
  (`--redo`면 다시).
- 사용량(결정 28): run과 판정을 띄우기 전마다 `get_usage`로 주간 사용률을 보고 50%에 닿으면 멈춘다. `get_usage`가
  사용량을 주지 않으면 결과 폴더의 `calls.jsonl`로 실제 claude 호출을 150번까지로 묶는다(AI 결정 51).
  사용량 한도로 실패하면 5시간 창은 재설정 시각까지 기다렸다 같은 run부터 잇고, 주간이면 멈춘다(결정 29).
- `--build-index`(run.mjs): 시나리오마다 구성별 빌드 인덱스를 만들고(C 컴파일러 필요) 제출 때 규칙 `config_active`로 검사해
  걸리면 2회까지 되돌린다(AI 결정 88). 기본은 끔이다. run.json의 `submitCheck`에 제출마다 걸린 문제, 되돌림 수, 받은 제출에
  남은 문제가 남고, 인덱스는 결과 폴더의 `build-index.<시나리오>.json`이다. 인덱스만 보거나 결과 하나를 검사하려면
  `node eval/extract/build-index.mjs [시나리오] [--out 폴더] [--check 결과.json]`.
- `--always-cap`(run.mjs, score.mjs): `get_usage`가 사용량을 주지 않으면 run의 `rate_limit_event`가 사용률을 알려 줘도
  `--max-calls` 상한을 함께 건다(AI 결정 76). 여러 이름표를 한 결과 폴더에 두면 `calls.jsonl` 하나로 함께 센다.
- 과제 고르기(run.mjs): 과제를 고르지 않으면 survey·trace 과제(10층)만 돈다. integrate·review·summarize는 `--kinds`나
  `--tasks`로 고른다. `--tasks`(report.mjs)는 그 과제의 행만 읽어 두 묶음의 채택을 따로 판정하게 한다. 저장본(`--runs-out`)에는
  run 종류(`kind`)가 남는다.
- 새 종류의 run: 기록으로 만든 패킷이 run 폴더의 `packet.md`로 남는다. integrate의 기록 목록은 run의 작업 폴더(레포와 scratch
  옆)에 쓰고 그 절대 경로를 패킷에 넣으며(쓰기·고치기 deny), 결과 폴더에 사본 `listing.md`를 둔다. 결과 스키마에는 칸의 키가
  든다: integrate는 `perspectives.md`의 관점 열, review는 패킷의 질문·서술 키. summarize에는 outcome·checkpoint가 없어 부드러운
  마감의 거부 이유가 "지금 쓴 것으로 제출"이다.
- 쪽 이름의 해시에는 과제마다 결과 스키마 칸의 키가 든다. survey·trace의 지시·스키마 바이트와 쪽 이름은 그대로다(시험이 v4
  측정 저장본의 해시와 견준다).

run 하나의 조건: 시나리오 `repo/`를 고정한 작성자·시각으로 커밋한 기준 레포(같은 내용이면 같은 커밋 id),
cwd는 레포 밖 scratch, `--add-dir`로 레포, 쪽의 조립본(지시 파일과 argv 스키마), 표준 입력으로 패킷(새 종류는 기록으로
만든 것), 앱과 같은 훅 설정(+ worktree 쓰기 deny). 끝 판정은 15.3절: 종료 코드 0, 오류 아님, 구조화 출력이 조립한 스키마를 통과, 마지막
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
- integrate: 연결(`link`: 종류가 같고 양쪽 ID가 겹친다. conflicts는 방향을 보지 않는다), 금지한 연결(`link_forbid`: 데이터시트가
  필요한 미확정을 푸는 resolves, 글은 같고 구성이 다른 두 주장 사이의 연결. kind가 없으면 어느 종류든, merges·conflicts는 방향
  없이), coverage 칸(`coverage`: 그 관점에서 상태가 맞고 요건을 채운 칸들, 곧 covered는 ids, not_applicable은 searches,
  unreached는 이 결과의 제안 단위를 가진 칸의 구성이 정답 구성을 모두 덮는다), 제안 단위(`unit`: 렌즈와 범위·목적의 토큰).
- review: 값 답(`answer_value`: 수치의 대조를 그대로 써서 병합·틀린 값은 PM-A), 구성 답(`answer_configs`: 구성 집합이 같다),
  서술 판정(`verdict`: 받는 판정 가운데 하나, `verdict_forbid`: 맞는 서술을 반박·범위 과장이라 함).
- summarize: 서술이 가리킨 ID(`cites`: risks·overview·handoff 또는 어디든, 모두 또는 하나).
- integrate·summarize: 패킷(integrate는 기록 목록까지)에 없는 전역 ID(`gid_unknown`). run 폴더의 `packet.md`·`listing.md`에서
  `packets.mjs`의 `packetIds`로 모은 ID와 견준다.
- 결정론 규칙은 그 결과 칸이 있는 종류에서만 돈다(`lib/score.mjs`의 `DET_KINDS`, 결정 54). 과제의 종류는 과제 id에서 짐작하지
  않고 `scenario.json`에서 받는다.
- 누출 카나리(정답 파일에만 있는 문자열)가 출력에 있으면 관문 위반.

판정 모델(sonnet, effort high, 도구·MCP·사용자 설정·세션 저장 없음): 결과를 `<절> <key>: <글>` 줄로 보이고 결정론이 가르지 않는
recall·must_not·resolvable 항목마다 found/violated/left_unknown과 근거 key를 받는다. 통과 규칙은 코드다: 가리킨 key가
결과에 있어야 인정한다(절 이름을 붙인 key는 마지막 낱말로 읽는다). 판정 모델이 유보(hedged)라고 본 금지 주장은 세지 않는다, 답이 없는 recall은 판정 불가로 분모에서 뺀다.

새 종류는 종류마다 판정 지시가 따로다(`JUDGE_SYSTEMS`). survey·trace의 지시와 주장 줄의 바이트는 그대로라 판정 캐시가 이어진다
(시험이 해시를 본다). 새 종류의 결과는 연결(`link l1`), coverage 칸(`coverage <관점>`), 제안 단위(`unit n1`), 답(`answer q1`),
판정(`verdict s1`), 서술(`overview p1`, `handoff h1`, `risk r1`) 줄로 보이고, 판정 답의 key 대조도 같은 key를 쓴다. 판정
항목에는 뜻만 남긴다: 충돌 연결이 코드가 지지하는 쪽을 밝히는가, 외부 자료가 필요한 값을 링크 밖(coverage 메모, 단위)에서
확정하는가, 반박의 근거가 맞는가, 서술이 상태를 올리거나 "모두 찾았다"고 하는가, 부분 분석을 밝히는가, 기록이나 코드로 정해지는
것을 미확정으로 두는가(소극화).

지표(결정 23):

| 지표                    | 정의                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| PM-A 잘못된 확정 수     | run 하나에서 위반한 must_not id 수(결정론과 판정의 합집합) + 수치 오류(trace의 수치, review의 값 답). 낮을수록 좋다 |
| PM-B 알려진 항목 재현율 | 그 과제의 recall 항목 가운데 찾은 비율(새 종류는 심은 연결·빈칸·틀린 주장·필수 언급). 높을수록 좋다                 |
| 관문                    | 누출 카나리, worktree 변경. 0이어야 한다                                                                            |
| 보조                    | 실패율, 지어낸 앵커 비율, 줄 어긋남 비율, 소극화(resolvable을 미확정으로 둔 수), 비용, 시간, 턴, 마감 도달          |

실패한 run은 주지표에서 빼고 실패율로 따로 센다(AI 결정 53). 쪽 비교는 시나리오·과제를 층으로 둔 bootstrap
95% 구간(10,000번, 고정 씨앗, `eval/primary.mjs`의 `compare`)이다.

## 5. 채택 기준

결정 23의 모양에 기준선과 A/A로 정한 숫자(결정 62)를 넣었다. 새 쪽 B를 base와 견줄 때:

- 관문(누출 카나리, worktree 변경)이 0이고, 실패율이 base보다 10%p 넘게 높지 않다.
- 그리고 둘 가운데 하나: PM-A 차이(B − base)의 95% 구간 상한 < 0이고 PM-B 차이의 하한 ≥ −0.03, 또는 PM-B 차이의 하한 > 0이고 PM-A 차이의 상한 ≤ +0.25.
- 채택한 판은 봉인 hold-out에서 같은 규칙으로 한 번 확인한다.

판정은 `report.mjs --pair 새,기준 --adopt`가 코드로 한다(AI 결정 75). 2026-10-09 6차 작업에서 첫 지침 판(v1)과 한 번 고친 판은
모두 채택하지 않았다(재현율 퇴보, requirements-extraction-flow.md 17.6절). 7차 작업의 v2와 그 고친 판(C2)은 재현율이 기준선과 같았으나 PM-A 구간 상한이
0.005로 0을 넘지 못해 채택하지 않았다(17.7절). 8차 작업의 v3(커밋 b5195bc)는 기준선 회차 1~9와 견줘 PM-A −0.209 [−0.329, −0.093],
PM-B −0.012 [−0.029, 0.004]로 채택했으나, 9차 작업의 봉인 hold-out 확인에서 PM-A −0.040 [−0.240, 0.120],
PM-B 0.018 [−0.008, 0.044]로 규칙을 넘지 못해 채택 판에서 내렸다(17.9절, 보고서 `2026-10-09-v3-holdout.md`). 11차 작업의 v4 문구(v3 + 메모리 배치 점검표와
앱 검사 목록 한 줄, 커밋 55b857f)는 개발용 10층에서 PM-A −0.300 [−0.420, −0.200], PM-B 0.008 [−0.008, 0.023]로 채택 조건을 넘었다(17.11절,
보고서 `2026-10-09-v4-m5.md`). 사람이 hold-out 확인 없이 v4를 채택 판으로 정했다(17.11.1절, 결정 62의 hold-out 확인을 이 판에서 건너뜀).
14차 작업에서 새 봉인 hold-out `extract-h2`로 확인했다(같은 때 회차 1~5, 5층): v4(W) − base(N)는 PM-A −0.240 [−0.520, 0.040],
PM-B 0.000 [−0.026, 0.027], 제출 검사를 더한 WI − N은 PM-A −0.280 [−0.560, 0.000], PM-B −0.008 [−0.038, 0.022]로 둘 다 규칙을 넘지
못했다. 쪽마다 run 25개(WI는 survey 5개)에 실패와 관문 위반은 0이고, WI의 제출 검사 되돌림은 run 하나에서 한 번이었다. 층별로는
survey의 PM-A가 N 3.40, W 2.00, WI 1.80이고 trace 넷은 0.00~0.60이다. v4를 채택 판에서 내리고 잠정 기본값으로 둔다(AI 결정 106,
보고서 `2026-10-09-v4-holdout.md`).

integrate·review·summarize는 survey·trace의 채택과 따로 본다(AI 결정 127). base(한 문단 과제 설명 + L3)와 v1(L1 + 종류
절차 + L3)을 같은 때에 쪽마다 회차 5로 돌리고, 6층(2 시나리오 × 3 과제)에 같은 규칙을 쓴다
(`report.mjs --tasks integrate,review,summarize --pair N,B --adopt`). 이 6층은 아직 측정하지 않았다(기준선도
이 측정이 처음이다).

근거: A/A의 차이가 PM-A 0.10 [−0.02, 0.22], PM-B 0.005 [−0.011, 0.020]였다(2026-10-09, `app/eval/extract/reports/2026-10-09-base-AA.md`). 기준선은 PM-A 0.25/run, PM-B 0.965이고 e1은 천장에 가깝다(개선은 주로 e2에서 갈린다).

판정 모델은 사람 대신 손으로 표본 확인했고(결정 60) 금지 주장마다 인용과 유보 여부를 받는다. 판정 규칙이나 정답 글을 고치면 두 쪽을 함께 다시 판정한다(입력 해시가 바뀌면 `score.mjs`가 다시 부른다).

## 6. 시험

- `npm run test:eval`(모델 없음): `eval/test/extract.test.mjs`와 `check-fixtures.mjs`(컴파일러가 없으면 건너뜀).
  시나리오마다 reference가 스키마를 통과하고 만점이며, 함정마다 해당 지표에서 reference보다 나빠야 한다. 새 종류의 reference는
  칸 키를 넣은 스키마와 앱의 제출 규칙(`rules.mjs`의 `checkResult`)도 통과해야 하고, 앵커 수는 summarize 밖에서만 본다. 함정의
  `expect`에는 찾음으로 남아야 할 항목(`found`)도 둘 수 있다.
- 채점 규칙을 고치면 이 시험에 경우를 더한다(CLAUDE.md). 실제 run에서 본 값 글은 회귀 시험으로 남긴다.
- 정답을 고치면 `reference/`와 `traps/`가 여전히 만점·검출인지 본다. 픽스처를 고치면 `check-fixtures.mjs`를 돌린다.

## 7. 봉인 hold-out

지침 판을 고른 뒤 같은 채택 규칙으로 한 번 확인하는 데만 쓴다(결정 62). 지침을 쓰거나 재는 세션은 열지도 보지도 않는다.

| 이름(`sealed/<이름>.tar.gz.enc`) | 내용                                                                               | 푼 뒤의 자리                      |
| -------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------- |
| `holdout`                        | 지식 실험의 hold-out(E9에서 풀어 소진)                                             | `eval/scenarios/`, `eval/guides/` |
| `extract-h1`                     | 요구사항 추출 run 평가의 hold-out 시나리오 하나(9차 작업에서 v3 확인에 써서 소진)  | `eval/extract/scenarios/`         |
| `extract-h2`                     | 요구사항 추출 run 평가의 hold-out 시나리오 하나(14차 작업에서 v4 확인에 써서 소진) | `eval/extract/scenarios/`         |

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
