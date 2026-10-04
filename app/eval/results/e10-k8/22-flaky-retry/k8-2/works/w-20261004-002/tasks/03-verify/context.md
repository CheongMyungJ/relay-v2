# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-002
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-k8/22-flaky-retry-k8-2/relay-home/projects/jobs-25abed/works/w-20261004-002/tasks/03-verify
- 작업 브랜치: relay/w-20261004-002
- 기준 브랜치: main
- 기준 커밋: e5b39e71bdbf93c6e9e216b2fbfb8353c2c732b9

## 승인 방식

수동 승인 (의도 승인, Work 완료는 늘 수동)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만], [push] 중 하나를 누르세요. [이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 리뷰할 때 변경이 그 항목을 어기는지도 본다.
- "기준 브랜치에는 아직 없다"고 적힌 항목은 머지를 기다리는 앞 Work에서 왔다. 그 Work가 고친 코드는 이 브랜치에 아직 없다. 같은 규칙을 어기는 코드가 이번 요청 밖에서 보이면 앞 Work가 이미 고친 곳일 수 있으니, 범위를 넓히지 말고 handoff의 `risks`에 "앞 Work(<id>)에서 고쳤을 수 있음, 머지 대기"로 적는다.
- 항목의 `## 규칙`(또는 `## 내용`)만 규칙과 사실이다. `## 아직 규칙을 따르지 않는 곳`은 아직 고치지 않은 코드, 곧 고칠 대상이다. 그 절이 없는 옛 형식의 항목은 글 전체를 읽는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/batch/flaky-test-policy.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
---
# 밤 배치는 병렬 4개를 유지하고, flaky 시험은 근본 원인을 고친다

## 규칙
- 배치 병렬 실행(동시 4개)은 유지한다. 순차 실행으로 되돌리는 것은 해결이 아니다.
- 간헐 실패하는 시험에 재시도, skip, 시간 제한 늘리기를 붙이지 않는다. 근본 원인을 고친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
```

#### docs/knowledge/batch/parallel-ordering-and-temp-names.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: pitfall
source: investigation
anchor: runPool
---
# 병렬 실행에서 결과 순서와 임시 파일 이름이 겹치는 실패

## 내용
- `runPool`(src/runner/pool.js)의 결과는 입력 순서여야 한다. `collectResults`(src/collect/collector.js)가 index로 job과 짝짓기 때문에, 완료 순서로 쌓으면 `report-N`이 엉뚱한 job에 묶인다.
- 보관소 임시 파일 이름(src/store/report-archive.js `saveReport`)을 ms 시각만으로 만들면 동시 저장에서 겹친다. 저장마다 고유한 값(reportId와 호출마다 늘어나는 번호)을 붙인다. 점으로 시작하고 `.tmp`로 끝나는 형식은 유지한다.
- 두 원인 모두 동시 4개에서만 나타나므로 `npm run test:ci`를 반복 실행해 확인한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

### 지식 남기기 (이 단계에서 할 일)

공통 종료 절차의 커밋 전에, 이 Work에서 알게 된 것 가운데 다음 일에도 쓸 사실을 레포의 `docs/knowledge/`에 남기고 코드와 함께 커밋한다. 팀이 PR로 함께 보고, 다음 일의 에이전트가 읽는다. 재료는 아래 지식 후보, Work 요청 원문(`request.md`), intent의 `비목표`와 `제약`, 결정 로그의 사람 결정(`by: human`), 이 task에서 사람이 한 말이다.

무엇을 남기나:

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(언제 무엇을 왜 바꿨나 등), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치.
- 사람이 요청이나 답에서 이번 일을 넘어 통하는 규칙을 말했으면(예: "금액은 늘 원 단위로 내림한다", "외부 API 응답은 캐시하지 않는다"), intent에 이번 Work의 비목표나 제약으로 들어가 있어도 지식으로 남긴다. 다음 일의 사람은 같은 말을 다시 하지 않아도 되어야 한다.
- 지식 후보 가운데 "(사람)"이 붙은 것은 이번 일에만 해당하지 않는 한 모두 남긴다. 사람이 알려 준 규칙은 하나도 빠뜨리지 않는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 항목은 만들지 않는다.

기존 항목을 고칠지 새로 만들지 (먼저 위 "항목"을 본다):

- 남길 것마다 위 항목 가운데 같은 대상(같은 규칙, 같은 값, 같은 코드 이름)을 다루는 것이 있는지 먼저 찾는다. 있으면 그 파일을 **같은 경로에서** 고친다. 이름이 달라도 대상이 같으면 같은 항목이다. 맞는 것이 없을 때만 새 파일을 만든다.
- 사람의 지금 말이 기존 항목과 어긋나면(값이나 규칙이 바뀌었으면) 그 항목을 반드시 고친다. 새 파일을 따로 만들어 옛 항목을 그대로 두지 않는다. `## 바뀐 이력`에 "<날짜> <옛 값> → <새 값> (Work <id>, 사람이 알려 줌)"을 한 줄 더한다.
- "기준 브랜치에는 아직 없다"고 적힌 항목은 이 worktree에 파일이 없다. 고칠 때는 위에 보인 앞 내용을 모두 살려 같은 경로에 새 형식으로 쓴다(머지하면 이 Work의 파일이 남는다). 고칠 것이 없으면 그 파일을 만들지 않는다.
- 한 사실은 한 곳에만 쓴다. 값이나 규칙은 그것을 다루는 항목 한 곳에만 적고, 다른 항목에서는 "<경로> 참고"로 가리킨다. 다른 항목에 곁들여 적은 값은 바뀔 때 함께 고쳐지지 않는다.

파일 형식 (앱이 확인한다. 틀리면 되돌아온다):

- 경로는 `docs/knowledge/<영역>/<이름>.md` 또는 `docs/knowledge/<이름>.md`. 영역과 이름은 영어 소문자, 숫자, `-` (예: `shipping/free-shipping-threshold.md`).
- `kind: rule`(이래야 한다)이면 본문 절은 `## 규칙`, 그 밖(`fact`, `history`, `pitfall`)은 `## 내용`이다.
- `## 규칙`에는 이래야 하는 것만 쓴다. 지금 코드가 규칙을 따르지 않는 곳(고칠 곳)은 `## 아직 규칙을 따르지 않는 곳`에 쓴다. "지금 코드는 ~를 쓴다"를 규칙처럼 쓰면 다음 사람이 그것을 규칙으로 읽는다.
- 규칙이 코드 이름(상수, 함수)에 붙어 있으면 머리글의 `anchor`에 그 이름을 적는다. 같은 `anchor`를 가진 항목이 둘이면 앱이 되돌린다.

```markdown
---
kind: rule            # rule | fact | history | pitfall
source: human         # human (사람이 알려 줌) | investigation (조사로 알아냄)
anchor: SOME_CONSTANT # 규칙이 붙은 코드 이름. 없으면 이 줄을 뺀다
---
# <한 줄 제목: 규칙이나 사실>

## 규칙
- <이래야 하는 것. 예와 수치>

## 아직 규칙을 따르지 않는 곳
- <경로>: <지금 어떻게 되어 있어 고쳐야 하나> (없으면 이 절을 뺀다)

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-002)
```

handoff에 적는 줄 (앱이 확인한다):

- `## 요약` 끝에 바꾼 지식 파일마다 한 줄: 새로 만든 파일은 `새 지식: <경로> — <맞는 기존 항목이 없는 까닭>`, 이미 있던 파일(위 항목에 보인 것)을 고쳤으면 `고친 지식: <경로> — <무엇이 바뀌었나>`.
- 바꾼 지식이 없으면 `남긴 지식: 없음 (까닭)`.

#### 앞 task들의 지식 후보

없음

## 선택 가능한 다음 단계

- 기본 다음 단계: Work 완료
- 이전 단계: intake (의도 정리), fix (원인 분석과 수정)

## intent (버전 1)

```markdown
---
schema_version: 1
version: 1
type: bugfix
---
## 목표
CI의 `npm run test:ci`에서 `ci/archive.test.js`가 간헐적으로 실패하는 문제를 근본 원인을 찾아 고친다. (로컬 `npm test`는 늘 통과하고, 재실행하면 통과한다.)

## 비목표
- `ci/batch.test.js`의 간헐 실패: 따로 고쳐 리뷰 중이므로 이번 범위가 아니다.
- 배치 병렬 실행(동시 4개)을 순차로 바꾸는 것.
- 시험에 재시도, skip, 시간 제한 늘리기를 붙이는 것.

## 원하는 결과
밤 배치 뒤 보고서가 보관소에 항상 제대로 남는다. 실패 로그에 나온 `ENOENT: 파일이 없습니다: reports/2026-09/.xxxx.tmp`와 `report-N 보관본의 고객사가 다르다`가 더 나타나지 않는다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다 (`npm test`도 통과한다)
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `ci/archive.test.js`에 재시도, skip, 시간 제한 늘리기가 추가되지 않는다
- [ ] 배치 병렬 동시 실행 수(4개)가 그대로다

## 제약
- (팀 지식 docs/knowledge/batch/flaky-test-policy.md) 배치 병렬 실행(동시 4개)은 유지한다. 순차 실행으로 되돌리는 것은 해결이 아니다.
- (팀 지식 docs/knowledge/batch/flaky-test-policy.md) 간헐 실패하는 시험에 재시도, skip, 시간 제한 늘리기를 붙이지 않는다. 근본 원인을 고친다.

## 추가 의견
- 실패 로그는 실행마다 조금씩 다르며, 임시 파일 ENOENT가 주로 나오고 고객사 불일치가 함께 나올 때도 있다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-k8/22-flaky-retry-k8-2/relay-home/projects/jobs-25abed/works/w-20261004-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 05:11 (사람 승인)
- [사람] 범위는 ci/archive.test.js의 간헐 실패로 한정하고 batch.test.js는 제외 — 요청 원문: batch.test.js는 따로 고쳐 리뷰 중
- [사람] 병렬 4개 유지, 재시도/skip/시간 늘리기 금지를 제약과 완료조건에 반영 — 팀 지식 flaky-test-policy.md의 규칙

## t-02 fix — 2026-10-04 05:13 (자동 승인)
- [AI] 임시 파일 이름을 reportId와 호출마다 늘어나는 번호로 고유하게 하고, runPool 결과를 입력 순서로 저장 — 팀 지식 docs/knowledge/batch/parallel-ordering-and-temp-names.md의 사실을 현재 코드에서 확인한 뒤 따름. 병렬 4개 유지와 재시도 금지 규칙(flaky-test-policy.md)도 지킴
```

## 누적 기각 목록

없음

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름을 reportId와 호출마다 늘어나는 번호로 고유하게 하고, runPool 결과를 입력 순서로 저장"
    why: "팀 지식 docs/knowledge/batch/parallel-ordering-and-temp-names.md의 사실을 현재 코드에서 확인한 뒤 따름. 병렬 4개 유지와 재시도 금지 규칙(flaky-test-policy.md)도 지킴"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 원인(runPool 순서, 임시 파일 이름)은 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 시 src/runner/pool.js와 src/store/report-archive.js에서 충돌 가능"
  - "tempSeq는 프로세스 내 카운터라 여러 프로세스가 같은 보관소에 동시에 쓰면 reportId와 시각이 같을 때 겹칠 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
`ci/archive.test.js` 간헐 실패는 두 원인이었다: 임시 파일 이름 충돌(ENOENT)과 `runPool`의 완료 순서 결과(고객사 불일치). 둘 다 고쳤고 재현 테스트 2개를 추가했다. 병렬 4개와 기존 테스트는 그대로다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`(results[start+i]), `src/store/report-archive.js:23`(임시 이름에 reportId, 시각, 순번).
- 재현 테스트: `test/pool.test.js`, `test/archive.test.js` 마지막 테스트. 수정 전 `npm test` fail 2, 수정 후 0.
- `npm run test:ci` 15회 연속 통과(수정 전 6회 중 5회 실패).
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e10-k8/22-flaky-retry-k8-2/relay-home/projects/jobs-25abed/works/w-20261004-002/tasks/02-fix/fix.md
