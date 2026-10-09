# 다음 세션용 프롬프트

아래 내용을 새 세션에 입력한다. [논의 기록](requirements-extraction-flow.md)은 이전 대화 없이 읽을 수 있도록 작성돼 있다. 4차 작업(녹화, 결과 스키마 v0, 평가 하네스, 기준선·A/A)은 17.4절, 봉인 hold-out은 17.5절, 지침 v1은 17.6절, 층 빼기와 v2는 17.7절, v3와 채택은 17.8절, v3의 hold-out 확인은 17.9절, 구성별 빌드 인덱스와 메모리 배치 점검표는 17.10절, 그 개발용 측정은 17.11절, AI가 정한 결정은 15.5.1절(결정 43~91)에 있다.

9차 작업의 결론: 개발용에서 채택한 지침 v3(커밋 b5195bc)는 봉인 hold-out(`extract-h1`)에서 결정 62를 넘지 못했다. base와 견줘 PM-A −0.040 [−0.240, 0.120], PM-B 0.018 [−0.008, 0.044](5층, 회차 5)이고 천장은 아니었다(base PM-A 0.44/run). 재현율은 퇴보하지 않았으나 잘못된 확정의 감소가 확인되지 않았다. 잘못된 확정은 두 쪽 모두 survey(0.80 대 0.80)와 trace-command(N 1.00, V 0.80)에 몰렸다. v3는 채택 판에서 내렸고(결정 86) 지금 채택한 판은 없다. `extract-h1`은 소진했다.

10차 작업: 사람의 요청으로 잘못된 확정을 구조로 막는 장치를 먼저 붙였다(17.10절). 구성별 빌드 인덱스(정의된 심볼, 전처리 뒤 살아 있는 줄)와 제출 검사 규칙 `config_active`(하네스는 `run.mjs --build-index`일 때만, 2회까지 되돌림), variant 렌즈 `memory_layout`·shared 렌즈 `dma_memory` 점검표다. 그래서 `skills/extract`의 문구는 v3가 아니라 새 판(v4, 커밋 55b857f)이다.

11차 작업: v4 문구(W)는 개발용 10층에서 base와 견줘 PM-A −0.300 [−0.420, −0.200], PM-B 0.008 [−0.008, 0.023]로 결정 62의 채택 조건을 넘었다(17.11절). 개발용이 v3의 이득을 크게 보인 전례(17.9)가 있어 새 hold-out 확인 전에는 채택 판으로 두지 않는다. 제출 검사(WI)는 개발용 survey에 잡을 구성 병합이 없어 효과를 가르지 못했고, 되돌림 1번은 앵커 줄이 틀린 데서 온 오탐이었다(모델은 앵커를 고쳐 다시 냄).

12차 작업: 사람이 hold-out 확인을 건너뛰고 v4를 채택했다(17.11.1). 그래서 v4가 앱의 기본 지시 판이다. 앱 구현의 설계 질문 넷은 사람이 정했고(17.12 표) 나머지는 결정 92~100이다. 첫 구현(로직, 저장, 순차 run 루프, 최소 화면)은 붙였고 진행과 남은 일은 17.12.1절에 있다. 실제 모델로 앱의 run을 끝까지 돌린 적은 아직 없다.

다음은 셋이다. 1(새 hold-out)이 끝나야 2(W의 hold-out 확인)를 할 수 있다. 2는 채택을 되돌릴지 보는 확인이다. 3은 나란히 할 수 있다.

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

## 3. 앱의 requirements 기능 다음 PR(나란히 할 수 있다)

첫 구현은 17.12.1절의 체크된 항목까지다. 다음 PR 후보는 17.12.1절의 체크되지 않은 항목이고, 먼저 실제 claude로 짧은 저장소 하나를 끝까지 돌려 run 판정·제출 검사·렌더링이 실제 출력에서 맞는지 본다. 그다음 앱 설정의 "요구사항 추출" 절(결정 31)과 구성별 빌드 인덱스(16.10, 결정 87·88)를 붙인다. 지시 원본은 `skills/extract`의 파일 그대로 읽으므로(결정 97) 판이 바뀌어도 앱 코드는 바뀌지 않는다.

## 남은 설계 논의(사람과 정할 것)

1. extract의 화면 나머지: run 목록·결과 화면, 알림과 배지(15.6절). 상태와 버튼, 사람 결정 양식은 17.12에서 정했다.
2. 재개·되감기와 결정 33의 고아 파일 규칙(17.3절 남은 문제): 되감기도 새 번호의 revision으로 쓰는 안.
3. 서브모듈 안의 근거(D382 ✅): 별도 읽기 전용 체크아웃을 `--add-dir`로 줄지, 경계로 둘지(17.3절 남은 문제).
4. intake와 verify의 requirements 구간(16.12절).
5. 평가 측정 환경: `get_usage`가 답하지 않는 클라우드 환경에서는 호출 상한(지금 200)으로 재야 해 표본이 작다. hold-out 확인은 5층이라 구간이 넓었다(PM-A 폭 0.36). 구독 PC에서 돌릴지, 상한을 늘릴지, hold-out 회차를 늘릴지.
6. review, integrate, summarize run과 state·lifecycle·protocol 렌즈의 지침과 평가(결정 18로 첫 범위 밖).
