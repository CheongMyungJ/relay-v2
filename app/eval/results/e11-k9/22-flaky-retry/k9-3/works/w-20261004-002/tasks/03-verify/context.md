# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-002
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e11-k9/22-flaky-retry-k9-3/relay-home/projects/jobs-ee5755/works/w-20261004-002/tasks/03-verify
- 작업 브랜치: relay/w-20261004-002
- 기준 브랜치: main
- 기준 커밋: d3a83e85741089f85b4c684c498ac05baf2ddbc3

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
- 항목의 `## 규칙`(또는 `## 내용`)만 규칙과 사실이다. `## 아직 규칙을 따르지 않는 곳`은 아직 고치지 않은 코드, 곧 고칠 대상이다. "범위에서 뺌"이라고 적혀 있어도 금지가 아니라 그때 Work의 범위였다. 이번 요청이 그 코드를 고치는 일이면 규칙대로 고친다. 그 절이 없는 옛 형식의 항목은 글 전체를 읽는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/runner/pool-result-order.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: investigation
anchor: runPool
---
# runPool 결과는 입력 순서여야 한다

## 규칙
- `runPool`(`src/runner/pool.js`)은 작업이 끝난 순서가 아니라 입력 순서대로 결과를 돌려준다. `collectResults`(`src/collect/collector.js`)가 `outcomes[i]`를 `jobs[i]`와 인덱스로 짝짓기 때문이다.
- 이를 어기면 조회 지연 jitter에 따라 보고서가 다른 작업에 붙는다 (`expected report-6 to belong to job-6, got job-5`).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/store/temp-file-unique-name.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: pitfall
source: investigation
---
# 동시에 쓰는 임시 파일 이름을 시각만으로 만들면 같은 ms에 겹친다

## 내용
- `saveReport`(`src/store/report-archive.js`)의 임시 파일 이름은 `.<reportId>.<stamp>.tmp`다. 시각만 쓰면 같은 ms에 동시에 저장하는 작업이 같은 파일을 덮어쓰거나 `rename`이 ENOENT로 실패한다.
- 동시에 쓰는 임시 파일 이름에는 고유 키(reportId)를 넣는다. 같은 reportId를 동시에 두 번 저장하는 경우는 보호하지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/testing/flaky-test-root-cause.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
---
# 간헐적으로 실패하는 시험은 재시도·skip·시간 제한 증가가 아니라 근본 원인을 고친다

## 규칙
- 간헐 실패(flaky)를 시험에 재시도를 붙이거나 skip하거나 시간 제한을 늘려 피하지 않는다. 근본 원인을 고친다.
- 병렬 실행(밤 배치 동시 4개)을 순차 실행으로 되돌려 문제를 피하지 않는다.
- 간헐 실패의 수정은 한 번 통과한 것으로 확인하지 않고 `npm run test:ci`를 여러 번 반복 실행해 확인한다.

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
- 사람이 이번 Work의 범위로 한 말("이번엔 손대지 마라", "다음에 따로 고친다", "이번 범위가 아니다")은 규칙이 아니다. "~는 수정하지 않는다" 같은 규칙으로 남기지 않는다. 사람이 "앞으로도 늘"처럼 오래 지킬 것으로 말했을 때만 규칙이다. 그 코드가 어떤 규칙을 아직 따르지 않으면, 그 규칙 항목의 `## 아직 규칙을 따르지 않는 곳`에 "<경로>: <지금 상태>. 사람이 Work w-20261004-002의 범위에서 뺌(2026-10-04)"으로 적는다.

기존 항목을 고칠지 새로 만들지 지울지 (먼저 위 "항목"을 본다):

- 남길 것마다 위 항목 가운데 같은 대상(같은 규칙, 같은 값, 같은 코드 이름)을 다루는 것이 있는지 먼저 찾는다. 있으면 그 파일을 **같은 경로에서** 고친다. 이름이 달라도 대상이 같으면 같은 항목이다. 맞는 것이 없을 때만 새 파일을 만든다.
- 사람의 지금 말이 기존 항목과 어긋나면(값이나 규칙이 바뀌었으면) 그 항목을 반드시 고친다. 새 파일을 따로 만들어 옛 항목을 그대로 두지 않는다. `## 바뀐 이력`에 "<날짜> <옛 값> → <새 값> (Work <id>, 사람이 알려 줌)"을 한 줄 더한다.
- "기준 브랜치에는 아직 없다"고 적힌 항목은 이 worktree에 파일이 없다. 고칠 때는 위에 보인 앞 내용을 모두 살려 같은 경로에 새 형식으로 쓴다(머지하면 이 Work의 파일이 남는다). 고칠 것이 없으면 그 파일을 만들지 않는다.
- 한 사실은 한 곳에만 쓴다. 값이나 규칙은 그것을 다루는 항목 한 곳에만 적고, 다른 항목에서는 "<경로> 참고"로 가리킨다. 다른 항목에 곁들여 적은 값은 바뀔 때 함께 고쳐지지 않는다.
- 이 Work가 어느 항목의 `## 아직 규칙을 따르지 않는 곳`에 적힌 코드를 고쳤으면, 그 줄을 지우고 `## 바뀐 이력`에 "<날짜> <경로>를 규칙대로 고침 (Work <id>)"을 더한다(앱이 확인한다). 아직 따르지 않으면 그 줄을 지금 상태로 고친다.
- 항목이 더는 맞지 않고 고쳐 쓸 내용도 없으면(규칙이 없어졌거나 다른 항목과 합쳤으면) 파일을 지운다(`git rm`). "기준 브랜치에는 아직 없다"고 적힌 앞 Work의 항목은 이 브랜치에 파일이 없어 지울 수 없으니 같은 경로에 고쳐 쓴다.

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
- <경로>: <지금 어떻게 되어 있어 고쳐야 하나. 사람이 범위에서 뺐으면 그렇다고> (없으면 이 절을 뺀다)

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-002)
```

handoff에 적는 줄 (앱이 확인한다):

- `## 요약` 끝에 바꾼 지식 파일마다 한 줄: 새로 만든 파일은 `새 지식: <경로> — <맞는 기존 항목이 없는 까닭>`, 이미 있던 파일(위 항목에 보인 것)을 고쳤으면 `고친 지식: <경로> — <무엇이 바뀌었나>`.
- 지운 파일마다 `지운 지식: <경로> — <까닭>`.
- 이 Work가 바꾼 코드가 어느 항목의 `## 아직 규칙을 따르지 않는 곳`에 있는데 그 항목을 그대로 두면 `확인한 지식: <경로> — <그대로 두는 까닭>`.
- 바꾼 지식이 없으면 `남긴 지식: 없음 (까닭)`.

#### 앞 task들의 지식 후보

- t-01 intake: 간헐적으로 실패하는 시험은 재시도·skip·시간 제한 증가가 아니라 근본 원인을 고친다. 이번 archive 시험에도 같다 (사람)
- t-02 fix: saveReport 임시 파일 이름을 시각만으로 만들면 동시 저장이 같은 ms에 겹쳐 ENOENT와 고객사 뒤바뀜이 난다. reportId를 넣어 고쳤다 (src/store/report-archive.js:23)
- t-02 fix: 간헐 실패 시험은 시각을 고정해 충돌을 결정적으로 만드는 재현 시험을 추가하고 반복 실행으로 확인한다

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
CI의 `npm run test:ci`에서 `ci/archive.test.js`(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 시험)가 가끔 실패하는 문제를 근본 원인부터 고친다.

## 비목표
- `ci/batch.test.js`의 간헐 실패 (따로 고쳐 리뷰 중이라 이번 범위 아님)

## 원하는 결과
`ci/archive.test.js`가 몇 번을 반복 실행해도 안정적으로 통과한다. 로컬 `npm test`는 계속 통과한다.

관찰된 실패 증상 (재실행하면 통과):
- `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`
- 가끔 함께: `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm run test:ci`를 여러 번 반복 실행해도 `ci/archive.test.js`가 매번 통과한다
- [ ] `npm test`가 통과한다

## 제약
- (팀 지식 docs/knowledge/testing/flaky-test-root-cause.md) 간헐 실패를 시험에 재시도를 붙이거나 skip하거나 시간 제한을 늘려 피하지 않는다. 근본 원인을 고친다.
- (팀 지식 docs/knowledge/testing/flaky-test-root-cause.md) 병렬 실행(밤 배치 동시 4개)을 순차 실행으로 되돌려 피하지 않는다.
- (팀 지식 docs/knowledge/testing/flaky-test-root-cause.md) 수정은 한 번 통과로 확인하지 않고 `npm run test:ci`를 여러 번 반복 실행해 확인한다.

## 추가 의견
- 실패 로그가 실행마다 조금씩 다르다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e11-k9/22-flaky-retry-k9-3/relay-home/projects/jobs-ee5755/works/w-20261004-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 09:11 (사람 승인)
- [사람] ci/batch.test.js는 비목표로 둔다 — 요청에서 따로 고쳐 리뷰 중이라 이번 범위가 아니라고 함

## t-02 fix — 2026-10-04 09:14 (자동 승인)
- [AI] 임시 파일 이름에 reportId를 넣는 것으로 고친다 — docs/knowledge/store/temp-file-unique-name.md 규칙과 같고 재시도·skip·순차화 없이 근본 원인을 고침
- [AI] ci/batch.test.js의 간헐 실패(runPool 순서)는 고치지 않는다 — intent의 비목표
```

## 누적 기각 목록

- t-02 fix: runPool 결과 순서: archive 시험은 reportId로 보관본을 읽어 인덱스 짝짓기에 의존하지 않음

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣는 것으로 고친다"
    why: "docs/knowledge/store/temp-file-unique-name.md 규칙과 같고 재시도·skip·순차화 없이 근본 원인을 고침"
    by: ai
  - what: "ci/batch.test.js의 간헐 실패(runPool 순서)는 고치지 않는다"
    why: "intent의 비목표"
    by: ai
assumptions:
  - "ci/batch.test.js의 실패는 runPool 입력 순서 문제로 보이며 기준 커밋에서 따로 확인하지 않았다"
rejected:
  - "runPool 결과 순서: archive 시험은 reportId로 보관본을 읽어 인덱스 짝짓기에 의존하지 않음"
open_questions: []
intent_deviation: null
risks:
  - "npm run test:ci는 ci/batch.test.js(비목표) 간헐 실패 때문에 가끔 실패한다 (30회 중 9회). 완료조건 'npm run test:ci가 통과한다'는 그 수정이 머지되어야 안정적으로 충족된다"
  - "앞 Work(w-20261004-001)에서 같은 saveReport 임시 파일 문제를 고쳤을 수 있음, 머지 대기. 머지 때 충돌 가능"
  - "같은 reportId를 동시에 두 번 저장하는 경우는 보호하지 않는다"
recommended_next: null
knowledge_candidates:
  - "saveReport 임시 파일 이름을 시각만으로 만들면 동시 저장이 같은 ms에 겹쳐 ENOENT와 고객사 뒤바뀜이 난다. reportId를 넣어 고쳤다 (src/store/report-archive.js:23)"
  - "간헐 실패 시험은 시각을 고정해 충돌을 결정적으로 만드는 재현 시험을 추가하고 반복 실행으로 확인한다"
---
## 요약
`saveReport`의 임시 파일 이름이 시각만으로 정해져 같은 ms의 동시 저장이 충돌하던 것을 `.<reportId>.<stamp>.tmp`로 고쳤다. 시각 고정 재현 시험을 추가했고 수정 전 실패, 수정 뒤 통과를 확인했다.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:23`. 시험: `test/archive.test.js` 마지막 시험.
- `npm test` 통과(63). `ci/archive.test.js`는 60회 연속 통과.
- `npm run test:ci`는 30회 중 9회 `ci/batch.test.js`(비목표, runPool 순서 추정) 때문에 실패했다. 이번 수정과 무관.
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e11-k9/22-flaky-retry-k9-3/relay-home/projects/jobs-ee5755/works/w-20261004-002/tasks/02-fix/fix.md
