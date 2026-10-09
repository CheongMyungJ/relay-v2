# 다음 세션용 프롬프트

아래 내용을 새 세션에 입력한다. [논의 기록](requirements-extraction-flow.md)은 이전 대화 없이 읽을 수 있도록 작성돼 있다. 4차 작업(녹화, 결과 스키마 v0, 평가 하네스, 기준선·A/A)은 17.4절, 봉인 hold-out은 17.5절, 지침 v1은 17.6절, 층 빼기와 v2는 17.7절, v3와 채택은 17.8절, v3의 hold-out 확인은 17.9절, AI가 정한 결정은 15.5.1절(결정 43~86)에 있다.

9차 작업의 결론: 개발용에서 채택한 지침 v3(커밋 b5195bc)는 봉인 hold-out(`extract-h1`)에서 결정 62를 넘지 못했다. base와 견줘 PM-A −0.040 [−0.240, 0.120], PM-B 0.018 [−0.008, 0.044](5층, 회차 5)이고 천장은 아니었다(base PM-A 0.44/run). 재현율은 퇴보하지 않았으나 잘못된 확정의 감소가 확인되지 않았다. 잘못된 확정은 두 쪽 모두 survey(0.80 대 0.80)와 trace-command(N 1.00, V 0.80)에 몰렸다. v3는 채택 판에서 내렸고(결정 86) 지금 채택한 판은 없다. `extract-h1`은 소진했다.

다음은 셋이다. 1은 2보다 먼저 끝나야 2의 판을 확인할 수 있다. 3은 나란히 할 수 있다.

## 1. 새 봉인 hold-out 만들기(지침을 쓰는 세션과 다른 세션)

```text
CheongMyungJ/relay-v2의 docs/requirements-extraction-flow-20261008 브랜치에서, 요구사항 추출 run 평가의 새 봉인 hold-out(extract-h2)을 만들어줘. 중간에 나에게 묻지 말고, 결정이 필요하면 결정 1~86과 기존 선례에 가장 잘 맞는 안을 골라 15.5.1절에 결정 87~로 적어.

먼저 CLAUDE.md, docs/extract-eval.md(2절, 4절, 6절, 7절), docs/requirements-extraction-flow.md(16.6절, 17.5절, 17.9절, 결정 22·64~68·85~86)를 읽어줘. 지침 문구(skills/extract), 채점 규칙, 채택 규칙(결정 62)은 고치지 않는다. 개발용 시나리오(e1, e2)와 지침 문구를 보고 그에 맞춰 함정을 고르지 않는다(지침 판에 맞춘 hold-out이 되지 않게).

할 일:
1. 17.5절과 결정 64~68의 꼴로 시나리오 h2를 만든다: 손으로 쓴 합성 펌웨어 약 4~5천 줄, 구성 둘, 과제 다섯, 정답·패킷·reference·함정·make-fixtures.py. 16.6절 점검표 밖의 범주를 하나 이상 넣는다. h1과 다른 장치 영역으로 한다.
2. check-fixtures.mjs와 npm run test:eval로 컴파일, reference 만점, 함정 검출을 본다.
3. openssl rand -hex 32로 열쇠를 만들어 HOLDOUT_KEY로만 쓰고 bash eval/seal.sh extract-h2 extract/scenarios/h2-<이름>으로 봉인한다. 평문을 레포 밖으로 옮긴 뒤 unseal.sh로 풀어 원본과 같은지와 시험 통과를 확인하고 평문을 지운다.
4. 레포에는 크기와 "점검표 밖 범주를 하나 이상 넣었다"만 적는다(결정 66). 열쇠, 함정 범주, 내용, 장치 영역은 끝 보고에서 나에게만 말한다. 17.10절에 기록하고 extract-eval.md 2절·7절의 표를 갱신한다.

실제 모델 run은 하지 않는다(결정 68). 작게 커밋하고 push한다. PR은 만들지 않는다. push 전에 app/에서 npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract && npm run test:eval, skills/에서 node check.mjs. 커밋 전마다 git diff --cached에 열쇠나 평문이 없는지 본다.
```

## 2. 다음 지침 세션(사람이 방향을 고른 뒤)

17.9.1절의 제안 가운데 사람이 고른다: (a) 개발용을 넓히기(점검표 밖 범주가 든 셋째 개발 시나리오 e3), (b) 소진한 h1을 개발용으로 돌려 쓰기(열쇠가 필요하고 결정 66의 기록 제한이 풀린다), (c) 호출 상한. 아래는 (a)를 고른 경우의 틀이다.

```text
CheongMyungJ/relay-v2의 docs/requirements-extraction-flow-20261008 브랜치에서, 요구사항 추출 지침의 다음 판(v4)을 만들고 결정 62로 재줘. 중간에 나에게 묻지 말고, 결정이 필요하면 결정 1~86과 기존 선례에 가장 잘 맞는 안을 골라 15.5.1절에 적어. 봉인 hold-out은 열지 않는다.

먼저 CLAUDE.md, docs/extract-eval.md, docs/requirements-extraction-flow.md(15.5.1절, 17.6~17.9절)를 읽어줘. 채점 규칙과 채택 규칙(결정 62)은 바꾸지 않는다.

할 일:
1. 개발용 셋째 시나리오 e3를 만든다(점검표 밖 범주를 하나 이상, e1·e2와 다른 장치 영역). check-fixtures.mjs와 npm run test:eval로 확인한다.
2. 17.9절의 숫자에서 출발한다: v3의 개발용 이득은 base에만 있던 잘못된 확정을 없앤 것이었고, hold-out에서는 두 쪽이 survey와 trace-command에서 같은 정도로 잘못된 확정을 냈다. 먼저 v3와 base를 e3에서 회차 5로 재서 같은 꼴이 개발용에서도 보이는지 본다.
3. 일반 규칙으로만 고친다(결정 72의 과적합 검사). 고친 판을 e1·e2·e3 전 층에서 회차 5로 base와 같은 때에 재고 report.mjs --pair <새>,N --adopt로 판정한다.

실제 claude 사용량: get_usage가 사용량을 주지 않는 환경이면 --always-cap --max-calls <사람이 정한 상한>으로 새 결과 폴더의 calls.jsonl 하나로 묶는다(15층 두 쪽이면 run 150 + 판정 최대 150). 사용량 한도 오류는 5시간 창이면 기다렸다 잇고 주간이면 멈춘다.

작게 커밋하고 push한다. PR은 만들지 않는다. push 전에 app/에서 npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract && npm run test:eval, skills/에서 node check.mjs. 끝나면 결과를 17.10절(또는 다음 빈 절)에 적고 이 파일을 갱신한다. 채택하면 새 hold-out(1)으로 확인하는 세션을 안내한다.
```

## 3. 앱의 requirements 기능 구현 PR(나란히 할 수 있다)

조립(`skills/extract/run.mjs`, `load.mjs`의 `loadLayers`), 규칙 표(`rules.mjs`), 정적 검사(`check.mjs` [6], [6b])는 지시 판과 상관없다. 구현 PR은 이것을 앱에 붙이고 지시 원본을 `skills/extract`의 파일 그대로 읽는다. 채택한 판이 없어 지금 문구(v3)는 잠정 기본값이다(결정 86). 다음 판이 채택되면 파일만 바뀐다. 시작 전에 아래 설계 논의를 사람과 정한다. 결정 13의 run 안 되돌림(StructuredOutput을 PreToolUse에서 검사)은 v3에서 높아진 trace-command의 줄 어긋남(개발용 0.36·0.42, hold-out 0.34)을 줄일 몫이다.

## 남은 설계 논의(사람과 정할 것)

1. extract task의 상태와 화면: 자기 CLI 세션이 없는 단계의 [재개]·[즉시 중단]·[멈춤]·재시작 조정·배지, run 목록·진행·결과 화면, 사람 결정 필요를 묻는 화면, 알림(15.6절).
2. 재개·되감기와 결정 33의 고아 파일 규칙(17.3절 남은 문제): 되감기도 새 번호의 revision으로 쓰는 안.
3. 서브모듈 안의 근거(D382 ✅): 별도 읽기 전용 체크아웃을 `--add-dir`로 줄지, 경계로 둘지(17.3절 남은 문제).
4. intake와 verify의 requirements 구간(16.12절).
5. D129의 run용 판정(필드가 없으면 실패)을 사람과 정하기(15.5절 끝).
6. 평가 측정 환경: `get_usage`가 답하지 않는 클라우드 환경에서는 호출 상한(지금 200)으로 재야 해 표본이 작다. hold-out 확인은 5층이라 구간이 넓었다(PM-A 폭 0.36). 구독 PC에서 돌릴지, 상한을 늘릴지, hold-out 회차를 늘릴지.
7. review, integrate, summarize run과 state·lifecycle·protocol 렌즈의 지침과 평가(결정 18로 첫 범위 밖).
