# 다음 세션용 프롬프트

아래 내용을 새 세션에 입력한다. [논의 기록](requirements-extraction-flow.md)은 이전 대화 없이 읽을 수 있도록 작성돼 있다. 4차 작업(구현 전 녹화, 결과 스키마 v0, 평가 하네스, 기준선·A/A 측정)의 결과는 17.4절, AI가 정한 결정은 15.5.1절(결정 43~)에 있다.

다음 단계는 둘이고 서로 다른 세션에서 한다. hold-out은 지침을 쓰는 세션이 보면 안 되므로(결정 22) 먼저 따로 만든다.

## 1. hold-out을 만들 세션

```text
CheongMyungJ/relay-v2의 docs/requirements-extraction-flow-20261008 브랜치에서 요구사항 추출 평가의 봉인 hold-out 시나리오를 하나 만들어줘. 중간에 나에게 묻지 말고, 결정이 필요하면 docs/requirements-extraction-flow.md 15.5.1절의 규칙(결정 1~42와 AI 결정 43~를 다시 열지 않음, 새로 정한 것은 이어 번호로 "AI가 정함")대로 정해.

먼저 CLAUDE.md, docs/extract-eval.md, docs/requirements-extraction-flow.md의 17.1절(결정 20~23)과 17.4절을 읽어줘. 개발용 시나리오(app/eval/extract/scenarios/e1-twoboard, e2-gateway)는 형식만 참고하고 함정 내용을 베끼지 마.

만들 것: 손으로 쓴 합성 펌웨어 하나(약 3~6천 줄, 구성 둘 이상), scenario.json(과제 다섯과 build·asserts), packets/, truth.json, reference/(만점), traps/. 16.6절 점검표에 없는 함정 범주를 하나 이상 넣는다(예: 리셋을 넘는 데이터, 링커 스크립트의 메모리 배치, 구조체 겹쳐 쓰기의 ABI 의존, 상대 장치의 가정). app/eval/extract/check-fixtures.mjs와 npm run test:eval(extract.test.mjs)이 그 시나리오로 통과해야 한다.

봉인: 시나리오 폴더를 AES-256으로 암호화해 app/eval/sealed/에 두고(기존 unseal.sh의 방식, 인자를 받게 고친다), 평문 폴더는 커밋하지 않는다. 열쇠는 나에게만 보고하고 레포·문서에 남기지 않는다. 봉인하는 스크립트와 푸는 법을 docs/extract-eval.md에 적는다.

작게 커밋하고 push한다. PR은 만들지 않는다. push 전에 app/에서 npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract를 통과시킨다. 끝나면 만든 것, 함정 범주(내용은 적지 말고 범주만), 열쇠를 보고해줘.
```

## 2. 지침 문구를 쓰고 재는 세션

```text
CheongMyungJ/relay-v2의 docs/requirements-extraction-flow-20261008 브랜치에서 요구사항 추출 extract run의 지침 문구(고정 계약 L1, 종류 절차 L2, 렌즈 카드의 나머지 절)를 쓰고, 4차 작업의 평가 하네스로 기준선과 견줘 채택 여부를 정한 뒤 보고해줘. 중간에 나에게 묻지 말고, 결정이 필요하면 아래 규칙대로 정해.

먼저 CLAUDE.md, CONTRIBUTING.md, docs/extract-eval.md, docs/requirements-extraction-flow.md(15.5절의 결정 1~42, 15.5.1절의 AI 결정 43~, 16.2~16.10절, 17.4절)를 읽고 전제가 바뀌었는지 확인해줘. hold-out 시나리오(봉인)는 열지도 보지도 않는다.

할 일(이 순서로):
1. 지침 문구: skills/extract/contract.md(L1, 16.5절의 묶음), kinds/{survey,trace}.md(L2), lenses/{command,timing,variant,shared}.md의 Scope·Trace·Pitfalls·Phrasing·Example 절. 영어(D98), 금지마다 "대신 어디에 적는가"(D230의 꼴), 넓은 금지 대신 기록할 곳(16.5). 개발용 픽스처의 함정을 직접 가리키는 문구는 쓰지 않는다(과적합, K5). 크기 목표는 16.10절. skills/check.mjs [6]에 금지 문구, 예시 통과·반례 실패 검사를 더한다(16.11 [정적]).
2. 새 쪽: app/eval/extract/lib/sides.mjs에 쪽을 더한다(조립은 skills/extract/run.mjs 그대로).
3. 측정: 새 쪽을 기준선 base와 같은 조건(sonnet/medium, 쪽·시나리오·과제마다 회차 5)으로 돌리고 score.mjs, report.mjs --pair로 견준다. 기준선은 2026-10-09에 잰 A와 A2다(app/eval/extract/reports/2026-10-09-base-AA.md, run마다의 점수는 .runs.json). 그 결과 폴더(app/eval/extract/results/m1, git에 없음)가 없거나 Claude Code·모델이 바뀌었으면 같은 조건으로 base를 다시 돌려 같은 때에 견준다.
4. 채택: 17.4절에 적은 주지표 한도(결정 23)로 판정한다. 채택하지 않으면 원인(과제별 놓친 항목, 잘못된 확정)을 보고 한 번 고쳐 다시 잴 수 있다. 고친 횟수를 보고에 적는다.

스스로 정하는 규칙:
- 결정 1~42, AI 결정 43~, design.md의 ✅ 결정은 다시 열지 않는다. 부딪치면 가장 덜 바꾸는 길로 진행하고 적는다.
- 새로 정한 것은 15.5.1절에 이어 번호로 "AI가 정함"과 함께, 고른 안, 이유, 버린 대안을 적는다.

실제 claude 사용량: 하네스가 run과 판정마다 get_usage로 주간 사용률을 보고 50%에서 멈춘다(결정 28, 51). get_usage가 사용량을 주지 않는 환경이면 호출 150회로 묶는다. 사용량 한도 오류는 5시간 창이면 기다렸다 잇고 주간이면 멈춘다. 한도 오류의 모양을 처음 보면 결정 52의 가정과 견줘 17.4.2절을 고친다.

작업 방식: 작게 커밋하고 자주 push한다. 진행과 다음 할 일을 17.4.4절(또는 이어지는 절)에 적는다. PR은 만들지 않는다. push 전에 app/에서 npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract, skills/에서 node check.mjs. D/I 번호 이전(결정 8)은 앱 기능 구현 PR에서 한다.

끝나면 한 번에 보고해줘: 만든 것과 위치, 통과한 시험, 쪽 비교(PM-A, PM-B, 관문, 보조 지표)와 채택 판정, 새로 정한 결정, 실제 claude 사용 횟수, 위험과 다음 단계(앱의 requirements 기능 구현 PR, 남은 설계 논의). 마지막으로 이 파일을 다음 단계용 프롬프트로 갱신해줘.
```

## 남은 설계 논의(앱 구현 전에 사람과 정할 것)

- extract task의 상태와 화면: 자기 CLI 세션이 없는 단계의 [재개]·[즉시 중단]·[멈춤]·재시작 조정·배지, run 목록·진행·결과 화면, 사람 결정 필요를 묻는 화면, 알림(15.6절).
- 재개·되감기와 결정 33의 고아 파일 규칙(17.3절 남은 문제): 되감기도 새 번호의 revision으로 쓰는 안.
- 서브모듈 안의 근거(D382 ✅): 별도 읽기 전용 체크아웃을 `--add-dir`로 줄지, 경계로 둘지(17.3절 남은 문제).
- intake와 verify의 requirements 구간(16.12절).
- D129의 run용 판정(필드가 없으면 실패)을 사람과 정하기(15.5절 끝).
