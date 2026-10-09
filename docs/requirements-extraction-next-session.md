# 다음 세션용 프롬프트

아래 내용을 새 세션에 입력한다. [논의 기록](requirements-extraction-flow.md)은 이전 대화 없이 읽을 수 있도록 작성돼 있다. 4차 작업(녹화, 결과 스키마 v0, 평가 하네스, 기준선·A/A)은 17.4절, 봉인 hold-out은 17.5절, 지침 v1은 17.6절, 층 빼기와 v2는 17.7절, v3와 채택은 17.8절, v3의 hold-out 확인은 17.9절, 구성별 빌드 인덱스와 메모리 배치 점검표는 17.10절, 그 개발용 측정은 17.11절, AI가 정한 결정은 15.5.1절(결정 43~104)에 있다.

9차 작업의 결론: 개발용에서 채택한 지침 v3(커밋 b5195bc)는 봉인 hold-out(`extract-h1`)에서 결정 62를 넘지 못했다. base와 견줘 PM-A −0.040 [−0.240, 0.120], PM-B 0.018 [−0.008, 0.044](5층, 회차 5)이고 천장은 아니었다(base PM-A 0.44/run). 재현율은 퇴보하지 않았으나 잘못된 확정의 감소가 확인되지 않았다. 잘못된 확정은 두 쪽 모두 survey(0.80 대 0.80)와 trace-command(N 1.00, V 0.80)에 몰렸다. v3는 채택 판에서 내렸고(결정 86) 지금 채택한 판은 없다. `extract-h1`은 소진했다.

10차 작업: 사람의 요청으로 잘못된 확정을 구조로 막는 장치를 먼저 붙였다(17.10절). 구성별 빌드 인덱스(정의된 심볼, 전처리 뒤 살아 있는 줄)와 제출 검사 규칙 `config_active`(하네스는 `run.mjs --build-index`일 때만, 2회까지 되돌림), variant 렌즈 `memory_layout`·shared 렌즈 `dma_memory` 점검표다. 그래서 `skills/extract`의 문구는 v3가 아니라 새 판(v4, 커밋 55b857f)이다.

11차 작업: v4 문구(W)는 개발용 10층에서 base와 견줘 PM-A −0.300 [−0.420, −0.200], PM-B 0.008 [−0.008, 0.023]로 결정 62의 채택 조건을 넘었다(17.11절). 개발용이 v3의 이득을 크게 보인 전례(17.9)가 있어 새 hold-out 확인 전에는 채택 판으로 두지 않는다. 제출 검사(WI)는 개발용 survey에 잡을 구성 병합이 없어 효과를 가르지 못했고, 되돌림 1번은 앵커 줄이 틀린 데서 온 오탐이었다(모델은 앵커를 고쳐 다시 냄).

12차 작업: 사람이 hold-out 확인을 건너뛰고 v4를 채택했다(17.11.1). 그래서 v4가 앱의 기본 지시 판이다. 앱 구현의 설계 질문 넷은 사람이 정했고(17.12 표) 나머지는 결정 92~100이다. 첫 구현(로직, 저장, 순차 run 루프, 최소 화면)은 붙였고 진행과 남은 일은 17.12.1절에 있다.

13차 작업(앱 구현 다음 PR, 결정 101~104): 실행 출력 근거의 인용 대조(제출·반영 검사, 결정 101), 앱 설정의 "요구사항 추출" 절(결정 102), 끝난 단위에 걸린 사람 결정의 답으로 그 단위를 다시 열기(결정 103), 뒤 단위가 다룬 미확정 잇기(결정 104)를 붙였다. 실제 claude로 리더보드 레포를 Work 완료까지 다시 돌렸다(`docs/checks.md` "요구사항 추출 유형", 커밋 7524447). 남은 앱 일은 대부분 아래 "남은 설계 논의"의 사람 결정을 기다린다.

14차 작업(진행 중, 2026-10-09): 사람이 4번 프롬프트로 "실제 펌웨어 시범 준비까지"를 맡겼다. 남은 설계 논의는 AI가 결정 105~129로 정했고(15.5.1절), 진행은 [17.13절](requirements-extraction-flow.md#1713-14차-작업-실제-펌웨어-시범-준비)의 표에 있다. 세션이 끊기면 아래 "5. 14차 작업 이어 하기"를 쓴다.

다음은 셋이다. 1(새 hold-out)이 끝나야 2(W의 hold-out 확인)를 할 수 있다. 2는 채택을 되돌릴지 보는 확인이다. 3은 나란히 할 수 있으나 먼저 "남은 설계 논의"에서 할 일을 사람이 정한다. 사람이 그 결정을 AI에게 맡기면 1~3 대신 4를 쓴다.

## 1. 새 봉인 hold-out 만들기(지침을 쓰는 세션과 다른 세션)

```text
CheongMyungJ/relay-v2의 docs/requirements-extraction-flow-20261008 브랜치에서, 요구사항 추출 run 평가의 새 봉인 hold-out(extract-h2)을 만들어줘. 중간에 나에게 묻지 말고, 결정이 필요하면 결정 1~91과 기존 선례에 가장 잘 맞는 안을 골라 15.5.1절에 결정 92~로 적어.

먼저 CLAUDE.md, docs/extract-eval.md(2절, 4절, 6절, 7절), docs/requirements-extraction-flow.md(16.6절, 17.5절, 17.9절, 결정 22·64~68·85~86)를 읽어줘. 지침 문구(skills/extract), 채점 규칙, 채택 규칙(결정 62)은 고치지 않는다. 개발용 시나리오(e1, e2)와 지침 문구를 보고 그에 맞춰 함정을 고르지 않는다(지침 판에 맞춘 hold-out이 되지 않게).

할 일:
1. 17.5절과 결정 64~68의 꼴로 시나리오 h2를 만든다: 손으로 쓴 합성 펌웨어 약 4~5천 줄, 구성 둘, 과제 다섯, 정답·패킷·reference·함정·make-fixtures.py. 16.6절 점검표(결정 89로 바뀐 것) 밖의 범주를 하나 이상 넣는다. h1과 다른 장치 영역으로 한다.
2. check-fixtures.mjs와 npm run test:eval로 컴파일, reference 만점, 함정 검출을 본다.
3. openssl rand -hex 32로 열쇠를 만들어 HOLDOUT_KEY로만 쓰고 bash eval/seal.sh extract-h2 extract/scenarios/h2-<이름>으로 봉인한다. 평문을 레포 밖으로 옮긴 뒤 unseal.sh로 풀어 원본과 같은지와 시험 통과를 확인하고 평문을 지운다.
4. 레포에는 크기와 "점검표 밖 범주를 하나 이상 넣었다"만 적는다(결정 66). 열쇠, 함정 범주, 내용, 장치 영역은 끝 보고에서 나에게만 말한다. 17.10절에 기록하고 extract-eval.md 2절·7절의 표를 갱신한다.

실제 모델 run은 하지 않는다(결정 68). 작게 커밋하고 push한다. PR은 만들지 않는다. push 전에 app/에서 npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract && npm run test:eval, skills/에서 node check.mjs. 커밋 전마다 git diff --cached에 열쇠나 평문이 없는지 본다.
```

## 2. v4(W)의 hold-out 확인(1이 끝나고 사람이 열쇠를 줄 때)

```text
CheongMyungJ/relay-v2의 docs/requirements-extraction-flow-20261008 브랜치에서, 개발용에서 채택 조건을 넘은 요구사항 추출 지침 v4(커밋 55b857f, 지금 skills/extract의 문구)를 봉인 hold-out extract-h2에서 결정 62의 규칙으로 확인하고 보고해줘. 열쇠는 명령의 환경 변수(HOLDOUT_KEY)로만 쓰고 레포의 파일, 문서, 커밋 메시지, 결과 폴더, 보고서에 적지 않는다. 중간에 나에게 묻지 말고, 결정이 필요하면 결정 1~91과 기존 선례에 가장 잘 맞는 안을 골라.

먼저 CLAUDE.md, docs/extract-eval.md(3절, 5절, 7절), docs/requirements-extraction-flow.md(15.5.1절, 17.9~17.11절)를 읽고 전제가 바뀌었는지 확인해줘. 지침 문구, 채점 규칙, 채택 규칙, 제출 검사 규칙은 이 세션에서 고치지 않는다.

할 일(17.9절과 같은 순서):
1. app/에서 npm ci 뒤 HOLDOUT_KEY='<열쇠>' bash eval/unseal.sh extract-h2로 푼다. 해시 확인이 실패하면 멈추고 보고한다. 평문은 커밋하지 않는다(git status로 확인).
2. node eval/extract/check-fixtures.mjs, npm run test:eval, node eval/extract/build-index.mjs <푼 id>(reference survey가 config_active를 통과하는지)로 확인한다. 실패하면 측정하지 말고 보고한다.
3. 결과 폴더 eval/extract/results/h2(git에 없음)에서 base(--side base, N), v4(--side v1, W), v4 + 제출 검사(--side v1 --build-index --tasks survey, WI)를 같은 때에 sonnet/medium, 회차 5로 돌린다(--scenarios <푼 id>, claude 프로세스는 넷 이하). WI의 trace 층은 결정 90대로 W run을 --as로 묶는다. score.mjs로 채점하고 report.mjs --pair W,N --adopt와 (--as를 붙여) --pair WI,N --adopt로 판정한다. 결정 68대로 두 쪽 모두 천장이면 가르지 못한 것으로 보고한다.
4. 보고서 app/eval/extract/reports/<날짜>-v4-holdout.md와 .runs.json은 결정 66·85대로 남긴다(잘못된 확정·놓친 항목 줄을 지우고 violated·missed·softened를 비움, 시나리오 id는 h2로 줄임). 제출 검사의 되돌림은 수만 적는다. 결과는 17.12절에 적는다.
5. 끝나면 푼 평문 폴더와 결과 폴더 h2를 지운다.

실제 claude 사용량: get_usage가 사용량을 주지 않으면 --always-cap --max-calls 200으로 h2의 calls.jsonl 하나에 묶는다(run 55 + 판정 약 55). 사용량 한도 오류는 5시간 창이면 기다렸다 잇고 주간이면 멈춘다.

판정에 따른 다음 단계: v4는 사람이 이미 채택해 앱의 기본 지시 판이다(17.12). 확인되면 그대로 둔다. 확인되지 않으면 사람에게 v4를 채택 판에서 내릴지 묻고 원인(쪽별·과제별 숫자로만)과 다음 지침 세션을 제안하며 hold-out은 소진으로 본다.

작게 커밋하고 push한다. PR은 만들지 않는다. push 전에 app/에서 npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract && npm run test:eval, skills/에서 npm ci 뒤 node check.mjs. 커밋 전마다 git diff --cached에 열쇠나 hold-out 평문이 없는지 확인한다. 끝나면 놓친 항목과 잘못된 확정은 보고에서만 말하고 이 파일을 갱신한다.
```

## 3. 앱의 requirements 기능 다음 PR(사람이 "남은 설계 논의"의 일부를 정한 뒤)

13차 작업까지 17.12.1절의 체크된 항목이다. 지시 원본은 `skills/extract`의 파일 그대로 읽으므로(결정 97) 판이 바뀌어도 앱 코드는 바뀌지 않는다. 사람 결정 없이 앱이 할 수 있는 일은 거의 남지 않았다: 아래 프롬프트의 할 일은 사람이 정한 항목에 맞춰 고친다.

```text
CheongMyungJ/relay-v2의 docs/requirements-extraction-flow-20261008 브랜치에서 요구사항 추출 기능의 다음 구현을 이어서 해줘. 중간에 나에게 묻지 말고, 결정이 필요하면 결정 1~104와 기존 relay 선례에 가장 잘 맞는 안을 골라 15.5.1절에 결정 105~로 적어. 다만 아래 "사람과 정할 것"에 걸리는 일은 하지 말고 끝 보고에서 제안만 해.

먼저 CLAUDE.md, CONTRIBUTING.md, docs/requirements-extraction-flow.md(15.2~15.6절, 15.5.1절의 결정 92~104, 17.12절과 17.12.1절), docs/requirements-extraction-next-session.md의 "남은 설계 논의", docs/checks.md의 "요구사항 추출 유형"을 읽어줘. 코드는 app/src/core/requirements.ts, app/src/adapters/requirements.ts, app/src/main/requirements.ts, app/src/main/work.ts의 extract 부분, app/src/renderer/src/Requirements.tsx다. 지침 문구(skills/extract의 L1·카드), 채점 규칙, 채택 규칙(결정 62)은 고치지 않는다.

할 일(차례대로, 하나씩 시험과 함께 커밋):
1. <사람이 정한 항목. 예: 실행 출력 사본에 입력(스크립트와 인자)도 남기기(17.12.1의 verify 지적), [범위 줄이고 계속](결정 26), run 목록과 결과 화면, 알림·배지(15.6)>
2. 끝나면 실제 claude로 RELAY_REAL_CLAUDE=1 RELAY_REAL_CASES=requirements npm run test:claude를 한 번 돌려 Work 완료까지 가는지 보고 docs/checks.md "요구사항 추출 유형" 표에 한 줄 더한다(task마다 되돌림·시간, run 수, 제출 되돌림과 규칙, 검증 지적 수). 실패하면 원인을 고치고 다시 돌린다. 사용량 한도 오류면 멈추고 보고한다.

사람과 정할 것(하지 말고 제안만): review·integrate·summarize run과 그 지침·평가, state·lifecycle·protocol 렌즈, 구성별 빌드 인덱스를 앱에서 만드는 방식(16.10), 저장소로 결과 내보내기, 재개·되감기의 고아 파일 규칙(17.3), 결과 스키마에 다른 run의 항목을 가리키는 칸(17.12.1의 통합 run 입력).

규칙: 한 동작은 가장 낮은 층에서 자세히 시험한다(CLAUDE.md). [실제] 시험을 고치면 RELAY_REAL_CLAUDE=dry도 통과시킨다. docs/checks.md에는 prettier를 돌리지 않는다. 화면을 고치면 npm run build 뒤 xvfb-run -a npx playwright test로 [스모크]를 돌린다. 끝나면 17.12.1절 진행 표, 15.5.1절 결정, 이 파일을 갱신한다.

작게 커밋하고 지정된 개발 브랜치와 docs/requirements-extraction-flow-20261008 두 곳에 push한다. PR은 만들지 않는다. push 전에 app/에서 npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract && npm run test:eval, skills/에서 npm ci 뒤 node check.mjs. 끝 보고에는 한 일, 실제 run 결과, 정한 결정, 사람과 정할 것의 제안을 적어줘.
```

## 4. 실제 펌웨어 시범 준비까지 한 번에(1~3과 "남은 설계 논의"를 AI가 정하고 끝까지)

사람이 "남은 설계 논의"를 따로 정하지 않고 AI에게 맡겼다(2026-10-09). 아래 하나로 1·2와 3을 대신한다. 목표는 실제 레거시 펌웨어로 시범 run을 할 수 있는 상태다.

```text
CheongMyungJ/relay-v2의 docs/requirements-extraction-flow-20261008 브랜치에서 요구사항 추출 기능을 "실제 레거시 펌웨어 저장소로 시범 run을 할 수 있는 상태"까지 개발해줘. 중간에 나에게 묻지 마. 사람과 정할 것으로 남겨 둔 항목(docs/requirements-extraction-next-session.md의 "남은 설계 논의", 17.12.1절)도 이번에는 네가 정한다. 결정 1~104, design.md의 ✅ 결정, 기존 relay 선례에 가장 잘 맞고 실제 펌웨어 시범에 더 나은 안을 골라 15.5.1절에 결정 105~로 적는다(고른 안, 이유, 버린 대안). 사람이 정한 결정 1~42와 17.12 표, design.md의 ✅ 결정과 부딪치면 그것을 바꾸지 말고 가장 덜 바꾸는 안을 고른 뒤 부딪친 점을 결정에 적고 끝 보고에서 알린다.

먼저 읽기: CLAUDE.md, CONTRIBUTING.md, docs/requirements-extraction-flow.md(15~17절, 특히 15.5.1의 결정 43~104, 16.4~16.12, 17.3, 17.12.1과 "통합 run 설계의 입력"), docs/extract-eval.md, docs/requirements-extraction-next-session.md 전체, docs/checks.md "요구사항 추출 유형". 코드: skills/extract/(contract.md, kinds/, lenses/, rules.mjs, run.mjs, load.mjs, build-index.mjs), skills/check.mjs, app/eval/extract/, app/src/core·adapters·main/requirements.ts, app/src/main/work.ts의 extract 부분, app/src/renderer/src/Requirements.tsx.

완료 조건(모두 되면 끝):
A. 새 봉인 hold-out extract-h2가 있고, 지금 지침 v4를 그것으로 결정 62의 규칙대로 확인해 결과를 17절과 docs/extract-eval.md에 남겼다.
B. integrate·review·summarize run이 지시(skills/extract), 결과 스키마(docs/contracts), 규칙 표와 반례, 평가(app/eval/extract), 앱 루프까지 붙어 있다.
C. 앱이 [범위 줄이고 계속]·[부분 분석으로 넘기기](결정 26), run 목록·결과 화면, 알림·배지(15.6), intake·verify의 requirements 구간(16.12), 앱이 만드는 구성별 빌드 인덱스와 config_active 제출 검사(16.10, 결정 87·88), 저장소로 결과 내보내기, 재개·되감기의 고아 파일 규칙(17.3), 실행 출력 사본에 입력도 남기기(17.12.1의 verify 지적)를 갖췄다.
D. state·lifecycle·protocol 렌즈 카드가 다른 렌즈처럼 Scope·Trace·Pitfalls·Phrasing·Example을 갖췄다(실제 펌웨어의 survey는 이 렌즈의 단위도 낸다).
E. 실제 claude로 RELAY_REAL_CLAUDE=1 RELAY_REAL_CASES=requirements npm run test:claude가 Work 완료까지 가고, 개발용 합성 펌웨어 e1(작은 두 보드)을 앱으로 intake부터 Work 완료까지 돌리는 [실제] 사례(integrate·summarize run 포함, run 상한 40)를 더해 그것도 Work 완료까지 간다. 둘 다 docs/checks.md에 적었다.
F. 실제 펌웨어 시범 세션용 프롬프트(사람이 준비할 것, 설정값, 지켜볼 것, 기록할 것)가 docs/requirements-extraction-next-session.md에 있다.

차례(앞 것이 뒤 것의 입력이다):
1. hold-out(A). 지침을 쓰는 세션과 hold-out을 만드는 쪽을 나누는 결정 22·66을 지키려고, hold-out은 Agent 도구로 띄운 하위 에이전트가 만든다. 이 파일의 "1. 새 봉인 hold-out 만들기" 프롬프트를 주되 보고는 열쇠, 크기, 시험 통과 여부만 하라고 바꾼다(함정 범주·내용·장치 영역은 봉인 묶음 안에만 둔다. 사람은 열쇠로 풀어 본다). 너는 h2의 평문 파일(시나리오 폴더, 정답, 함정, make-fixtures.py)을 직접 열어 읽지 않는다. 그 뒤 "2. v4(W)의 hold-out 확인" 프롬프트의 절차를 네가 한다(열쇠는 명령의 환경 변수로만). 확인되면 v4 그대로 두고, 확인되지 않으면 결정 86처럼 채택 판에서 내리되 잠정 기본값으로 두고 진행하며 원인은 쪽별·과제별 숫자로만 적는다. 이 단계에서 지침 문구는 고치지 않는다. 끝나면 평문과 결과 폴더를 지운다. h2는 소진된다.
2. 설계 결정을 한 번에 정해 15.5.1에 적고 커밋한다(아래 "출발점"에서 시작).
3. integrate → review → summarize 차례로 하나씩: 결과 스키마 v0, 지시(kinds/<종류>.md, L1은 꼭 필요할 때만), rules.mjs 규칙과 반례, check.mjs, 평가 픽스처와 채점(결정 21의 꼴: 결정론 + 판정 모델, reference 만점과 함정 검출을 npm run test:eval에서), 최소 지시 판(base) 대 새 판 측정(결정 62의 꼴), 앱 루프 연결과 [단위]·[어댑터]·[흐름] 시험.
4. state·lifecycle·protocol 카드(D). 개발용 시나리오에 그 렌즈의 과제를 더할 수 있으면 더해 base 대비로 재고, 사용량이 모자라면 정적 검사(check.mjs의 예시·과적합 검사)와 E의 실제 run으로 갈음하고 미측정이라 적는다.
5. 앱의 나머지(C). 화면을 고치면 [스모크].
6. 실제 run(E)과 기록, 시범 안내(F).

출발점(근거가 다르면 바꾸되 결정으로 적는다):
- 다른 run의 항목 가리키기: 패킷에 관련 기록의 전역 ID(c-, u-, h-)와 요약을 주고, integrate 결과가 resolves(미확정 → 그것을 푸는 주장·근거), supersedes(앞 주장 → 대체 주장), merges(같은 주장들), conflicts(서로 어긋나는 주장)를 낸다. 앱은 변경분 스키마의 연결로 받아 extraction.md에서 앞 것을 접어 보인다. 상태를 올리지 않는다(결정 12): "풀림"은 뒤 근거를 가리키는 연결이지 확정이 아니다.
- 때: integrate는 열린 단위가 없어 끝내기 직전에 한 번, 그리고 반영한 trace가 일정 수(예: 10)를 넘을 때마다. review는 표본(비율과 고르는 규칙을 정한다, 16.12)으로 integrate 뒤에. summarize는 끝에 한 번이고 부분 분석이면 상한 밖에서 한 번(결정 26). summarize는 {글, refs} 서술과 handoff 요약·risks만 내고 문서는 앱이 렌더링한다(결정 15).
- 빌드 인덱스: intake의 intent가 툴체인과 빌드 명령을 허용할 때만, Work 디렉터리 아래 기준 커밋의 읽기 전용 별도 worktree에서 skills/extract/build-index.mjs와 하네스의 컴파일러 찾기를 써서 만든다. 실패하거나 허용이 없으면 config_active 없이 돌고 extraction.md에 그렇다고 적는다(결정 14).
- 내보내기: verify 승인 뒤 Work 완료 화면에서 extraction.md와 기록 JSON 묶음(스키마 판 포함)을 사람이 고른 레포 경로로 커밋하는 길(spec의 D364 꼴). 채택 칸은 "미결정"(결정 1).
- 고아 파일: 되감기도 새 번호 revision으로 쓰고, requirements/outputs/의 사본은 내용 해시라 지우지 않는다.
- 화면: run 목록은 진행 상자 아래 접힌 표(run, 단위, 종류, 결과, 제출 되돌림, 시간)와 run 기록 폴더 열기. 알림은 D81·D184 그대로(사람 결정 필요, 멈춤).

평가와 사용량:
- 지침을 바꾸면 결정 62의 규칙으로 잰다. survey·trace의 지시 바이트(L1 포함)를 바꾸면 개발용 10층을 다시 재야 하므로 새 run 종류의 지시는 kinds/<종류>.md에 두고 L1은 꼭 필요할 때만 고친다. L1을 고치게 되면 앱 검사 목록에 tool_output 앵커(결정 101)를 함께 넣고 10층을 다시 잰다.
- get_usage가 사용량을 주지 않으면 --always-cap으로 결과 폴더마다 상한을 건다: hold-out 확인 200, 새 run 종류와 렌즈의 평가 합계 400. 넘을 것 같으면 회차·층을 줄이고 결정으로 적는다. 앱으로 도는 [실제] 사례는 이 상한 밖이다. 사용량 한도 오류는 5시간 창이면 기다렸다 잇고, 주간이면 그때까지를 커밋·push하고 멈춘 뒤 보고한다.
- hold-out 열쇠는 레포·문서·커밋 메시지·결과 폴더·보고서에 쓰지 않고 끝 보고에서만 말한다. 커밋 전마다 git diff --cached에 열쇠나 h2 평문이 없는지 본다.

규칙: CLAUDE.md의 시험 층(한 동작은 가장 낮은 층에서 자세히). [실제] 시험을 고치면 RELAY_REAL_CLAUDE=dry도 통과. 훅 본문·claude 옵션·gh JSON의 새 필드를 쓰면 app/test/contract의 계약과 녹화본(8.2). docs/checks.md에는 prettier를 돌리지 않는다. 화면을 고치면 npm run build 뒤 xvfb-run -a npx playwright test. 결정 8의 D/I 번호 옮기기와 main으로의 PR은 이번에 하지 않는다.

진행 기록: 큰 차례가 끝날 때마다 17절의 새 절(14차 작업)과 진행 표, 15.5.1 결정, docs/requirements-extraction-next-session.md를 갱신하고 커밋·push한다. 세션이 끊겨도 다음 세션이 그 파일만 읽고 이을 수 있게 남은 차례와 이어 하기 프롬프트를 늘 최신으로 둔다.

작게 커밋하고 지정된 개발 브랜치와 docs/requirements-extraction-flow-20261008 두 곳에 push한다. PR은 만들지 않는다. push 전에 app/에서 npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract && npm run test:eval, skills/에서 npm ci 뒤 node check.mjs.

끝 보고(한국어): 완료 조건 A~F마다 된 것과 안 된 것, hold-out 확인 결과(열쇠는 여기서만), 측정 숫자, 실제 run 결과, 정한 결정 목록(사람이 다시 볼 만한 것을 표시), 실제 펌웨어 시범 전에 사람이 준비할 것.
```

## 5. 14차 작업 이어 하기(세션이 끊겼을 때)

```text
CheongMyungJ/relay-v2의 docs/requirements-extraction-flow-20261008 브랜치에서 14차 작업(요구사항 추출을 실제 레거시 펌웨어 시범 run을 할 수 있는 상태까지)을 이어서 해줘. 중간에 나에게 묻지 마. 이 파일 4번의 프롬프트가 원래 지시이고(완료 조건 A~F, 차례 1~6, 평가와 사용량, 규칙), 정한 설계는 docs/requirements-extraction-flow.md 15.5.1절의 결정 105~, 진행은 17.13절의 표다. 표에서 "남음"과 "진행 중"인 차례부터 4번의 규칙대로 한다. 새로 정할 것은 결정 130~으로 적는다.

먼저 CLAUDE.md, CONTRIBUTING.md, docs/requirements-extraction-flow.md(15.5.1의 결정 92~, 16.4, 17.12.1, 17.13), docs/extract-eval.md, 이 파일 4번을 읽고 git log로 마지막 커밋을 본다. hold-out(extract-h2)의 열쇠는 레포에 없다: 차례 1이 끝나지 않았으면 결정 105의 절차를 처음부터 다시 하지 말고, sealed/extract-h2.*가 커밋돼 있으면 열쇠를 사람에게 받아야 하므로 차례 1의 확인은 건너뛰고 끝 보고에 적는다(그때만 사람이 열쇠를 줄 때 4번의 차례 1 둘째 절을 한다).

작게 커밋하고 지정된 개발 브랜치와 docs/requirements-extraction-flow-20261008 두 곳에 push한다. PR은 만들지 않는다. push 전에 app/에서 npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract && npm run test:eval, skills/에서 npm ci 뒤 node check.mjs. 큰 차례가 끝날 때마다 17.13절 표, 15.5.1 결정, 이 파일을 갱신한다.
```

## 남은 설계 논의(사람과 정할 것)

14차 작업에서 아래 항목은 모두 AI가 정했다(결정 107~129, 각 항목 끝의 제안과 다르게 정한 것은 그 결정에 까닭이 있다). 기록으로 남긴다.

13차 작업이 붙인 제안(AI의 안, 사람이 고른다)을 각 항목 끝에 적었다.

1. extract의 화면 나머지: run 목록·결과 화면, 알림과 배지(15.6절). 상태와 버튼, 사람 결정 양식은 17.12에서 정했다. 제안: run 목록은 진행 상자 아래 접힌 표(run, 단위, 결과, 제출 되돌림, 걸린 시간)로 두고 run 기록 폴더를 연다. 알림은 기존 D81·D184 그대로 "사람 결정 필요"와 멈춤에만 건다.
2. 재개·되감기와 결정 33의 고아 파일 규칙(17.3절 남은 문제): 되감기도 새 번호의 revision으로 쓰는 안. 제안: 그 안대로 하되 `requirements/outputs/`의 사본은 내용 해시라 고아가 되어도 지우지 않는다(다른 revision이 같은 사본을 가리킬 수 있다).
3. 서브모듈 안의 근거(D382 ✅): 별도 읽기 전용 체크아웃을 `--add-dir`로 줄지, 경계로 둘지(17.3절 남은 문제).
4. intake와 verify의 requirements 구간(16.12절).
5. 평가 측정 환경: `get_usage`가 답하지 않는 클라우드 환경에서는 호출 상한(지금 200)으로 재야 해 표본이 작다. hold-out 확인은 5층이라 구간이 넓었다(PM-A 폭 0.36). 구독 PC에서 돌릴지, 상한을 늘릴지, hold-out 회차를 늘릴지.
6. review, integrate, summarize run과 state·lifecycle·protocol 렌즈의 지침과 평가(결정 18로 첫 범위 밖). 제안: integrate run을 먼저 한다. 13차 실제 run에서 미확정 6건이 모두 refs로 뒤 단위에 이어지지 않았고(결정 104가 다루지 못함), 다시 연 단위는 앞 주장을 남긴다(결정 103). 입력은 17.12.1의 "통합 run 설계의 입력"이다. 결과 스키마에 `resolves`·`supersedes`(전역 ID를 가리키는 칸)를 더하면 L3가 바뀌므로 지침 평가와 같은 세션에서 정한다.
7. 구성별 빌드 인덱스를 앱에서 만드는 방식(16.10, 결정 87·88): 제안: intake가 빌드 명령과 툴체인을 허용할 때만, Work 디렉터리 아래 별도 체크아웃(기준 커밋, 읽기 전용 worktree)에서 하네스의 `build-index.mjs`와 같은 인자로 만들고, 실패하면 `config_active` 없이 돈다(결정 14의 inference 갈래).
8. 저장소로 결과 내보내기: 제안: verify 승인 뒤 Work 완료 화면의 [결과 문서 PR] 하나로 `extraction.md`와 기록의 JSON 묶음을 사람이 고른 경로에 커밋한다(spec의 D364 꼴). 채택 칸은 "미결정"(결정 1).
9. L1의 앱 검사 목록(지침): 결정 101로 `quote_match`가 실행 출력 앵커도 보는데 L1은 "Each `code` anchor's ... quote"라고만 한다. 다음 지침 세션에서 "code and tool_output anchors"로 넓히고 평가한다.
