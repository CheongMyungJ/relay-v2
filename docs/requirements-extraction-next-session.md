# 다음 세션용 프롬프트

아래 내용을 새 세션에 입력한다. [논의 기록](requirements-extraction-flow.md)은 이전 대화 없이 읽을 수 있도록 작성돼 있다. 4차 작업(녹화, 결과 스키마 v0, 평가 하네스, 기준선·A/A)은 17.4절, 봉인 hold-out은 17.5절, 지침 v1은 17.6절, 층 빼기와 v2는 17.7절, v3와 채택은 17.8절, AI가 정한 결정은 15.5.1절(결정 43~84)에 있다.

8차 작업의 결론: 지침 v3(커밋 b5195bc, 지금 `skills/extract`의 문구)를 결정 62로 채택했다. 기준선(base 회차 1~9)과 견줘 PM-A −0.209 [−0.329, −0.093], PM-B −0.012 [−0.029, 0.004]다. 재현율 쪽 여유가 얇아(한도 −0.03에 0.001) 결정 62의 hold-out 확인이 중요하다. hold-out은 아직 열지 않았다.

다음은 둘이다. hold-out 확인은 사람이 열쇠를 줘야 한다.

## hold-out 확인 세션(사람이 열쇠를 줄 때)

```text
CheongMyungJ/relay-v2의 docs/requirements-extraction-flow-20261008 브랜치에서, 채택한 요구사항 추출 지침 v3(커밋 b5195bc)를 봉인 hold-out에서 결정 62의 규칙으로 확인하고 보고해줘. 열쇠는 HOLDOUT_KEY='<열쇠>'다. 중간에 나에게 묻지 말고, 결정이 필요하면 아래 규칙대로 정해.

먼저 CLAUDE.md, docs/extract-eval.md(특히 5절, 7절), docs/requirements-extraction-flow.md(15.5.1절의 AI 결정 43~84, 17.5절, 17.8절)를 읽고 전제가 바뀌었는지 확인해줘. 지침 문구(skills/extract)는 이 세션에서 고치지 않는다.

할 일:
1. docs/extract-eval.md 7절대로 app/에서 bash eval/unseal.sh extract-h1로 푼다. 열쇠를 레포, 문서, 커밋 메시지, 결과 폴더에 남기지 않는다. 푼 평문은 커밋하지 않는다(.gitignore가 뺀다).
2. node eval/extract/check-fixtures.mjs와 npm run test:eval로 풀린 시나리오가 컴파일되고 reference 만점·함정 검출인지 본다.
3. v3(--side v1)와 base(--side base)를 푼 시나리오에서 같은 때에 sonnet/medium, 과제마다 회차 5로 돌리고 score.mjs로 채점한 뒤 report.mjs --pair v3이름표,base이름표 --adopt로 결정 62의 규칙을 판정한다. 결정 68대로 두 쪽 모두 천장이면 가르지 못한 것으로 보고하고 새 hold-out이 필요하다고 적는다.
4. 결과를 17.9절에 적는다. hold-out의 함정 범주와 내용은 레포에 적지 않는다(결정 66): 숫자, 판정, 과제별 PM-A·PM-B만 적고 무엇을 놓쳤는지는 보고에서 사람에게만 말한다.

실제 claude 사용량: get_usage가 사용량을 주지 않는 환경이면 --always-cap --max-calls 200으로 새 결과 폴더의 호출을 묶는다(결정 76, 78). 사용량 한도 오류는 5시간 창이면 기다렸다 잇고 주간이면 멈춘다.

작업 방식: 작게 커밋하고 push한다. PR은 만들지 않는다. push 전에 app/에서 npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract && npm run test:eval, skills/에서 node check.mjs. 끝나면 푼 평문 폴더를 지운다.

끝나면 한 번에 보고해줘: 확인 결과(PM-A, PM-B, 관문, 판정), 놓친 항목과 잘못된 확정(사람에게만), 실제 claude 사용 횟수, 다음 단계. 마지막으로 이 파일을 다음 단계용 프롬프트로 갱신해줘.
```

## 앱의 requirements 기능 구현 PR(hold-out 확인과 나란히 시작할 수 있다)

조립(`skills/extract/run.mjs`, `load.mjs`의 `loadLayers`), 규칙 표(`rules.mjs`), 정적 검사(`check.mjs` [6], [6b])는 지시 판과 상관없다. 구현 PR은 이것을 앱에 붙이고 v3 문구를 기본으로 넘긴다. hold-out 확인에서 v3가 떨어지면 판을 바꿀 수 있게 지시 원본은 `skills/extract`의 파일 그대로 읽는다. 시작 전에 아래 설계 논의를 사람과 정한다. 결정 13의 run 안 되돌림(StructuredOutput을 PreToolUse에서 검사)은 v3에서 높아진 줄 어긋남(e1·e2 trace-command 0.36·0.42)을 줄일 몫이다.

## 남은 설계 논의(사람과 정할 것)

1. extract task의 상태와 화면: 자기 CLI 세션이 없는 단계의 [재개]·[즉시 중단]·[멈춤]·재시작 조정·배지, run 목록·진행·결과 화면, 사람 결정 필요를 묻는 화면, 알림(15.6절).
2. 재개·되감기와 결정 33의 고아 파일 규칙(17.3절 남은 문제): 되감기도 새 번호의 revision으로 쓰는 안.
3. 서브모듈 안의 근거(D382 ✅): 별도 읽기 전용 체크아웃을 `--add-dir`로 줄지, 경계로 둘지(17.3절 남은 문제).
4. intake와 verify의 requirements 구간(16.12절).
5. D129의 run용 판정(필드가 없으면 실패)을 사람과 정하기(15.5절 끝).
6. 평가 측정 환경: `get_usage`가 답하지 않는 클라우드 환경에서는 호출 상한(지금 200)으로 재야 해 표본이 작다. 구독 PC에서 돌릴지, 상한을 더 늘릴지.
7. review, integrate, summarize run과 state·lifecycle·protocol 렌즈의 지침과 평가(결정 18로 첫 범위 밖).
