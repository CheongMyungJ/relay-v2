# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-002
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-k8/22-flaky-retry-k8-5/relay-home/projects/jobs-553a03/works/w-20261004-002/tasks/03-verify
- 작업 브랜치: relay/w-20261004-002
- 기준 브랜치: main
- 기준 커밋: ced2512784fe33fe1fbe5a394d3e47b33a495e5f

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

#### docs/knowledge/runner/run-pool-result-order.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: investigation
anchor: runPool
---
# runPool 결과는 끝난 순서가 아니라 items 순서와 같아야 한다

## 규칙
- `runPool(items, ...)`이 돌려주는 배열의 i번째는 `items[i]`의 결과다. `collectResults`(`src/collect/collector.js`)가 `outcomes[i]`를 `jobs[i]`와 index로 짝짓기 때문이다.
- 지연이 없는 로컬 `npm test`는 완료 순서가 입력 순서와 거의 같아 어겨도 통과한다. 지연이 있는 `npm run test:ci`에서만 가끔 실패한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/store/report-temp-file-name.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: pitfall
source: investigation
anchor: saveReport
---
# 보고서 임시 파일 이름은 시각만으로 만들면 동시 저장끼리 겹친다

## 내용
- `saveReport`(`src/store/report-archive.js`)는 임시 파일에 쓴 뒤 rename한다. 이름이 `stamp(now())`뿐이면 같은 ms에 시작한 동시 저장(동시 4개)이 같은 임시 파일을 쓴다. 한쪽이 rename하면 다른 쪽은 ENOENT로 실패하고, 겹쳐 쓰면 보관본에 다른 고객사의 내용이 들어간다.
- 임시 이름에는 보고서마다 다른 값(`reportId`)을 넣는다. 접두 `.`와 접미 `.tmp`는 `listReports`와 `strayTemps`가 쓰므로 유지한다.
- 재현은 `node --test ci/archive.test.js` 반복 실행(수정 전 20회 중 5회 실패).
```

#### docs/knowledge/testing/flaky-tests-fix-the-cause.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
---
# 간헐 실패는 재시도·skip·시간 제한 증가·순차 실행으로 덮지 않고 원인을 고친다

## 규칙
- 시험이 가끔 실패하면 재시도를 붙이거나, skip하거나, 시간 제한을 늘리지 않는다.
- 순차 실행으로 되돌리는 것도 해결이 아니다. 병렬 실행(동시 4개, `concurrency: 4`)은 유지한다.
- 조회 지연 값(`LATENCY`)이나 시험의 기대값을 바꿔 증상을 가리지 않는다. `src/`의 원인 코드를 고친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
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
CI 전용 시험 `ci/archive.test.js`(밤 배치 뒤 보고서가 보관소에 제대로 남는지 확인)가 `npm run test:ci`에서 가끔 실패하는 원인을 찾아 `src/`에서 고친다.

## 비목표
- `ci/batch.test.js`의 간헐 실패는 따로 고쳐 리뷰 중이므로 이번 범위가 아니다.
- 시험 코드, 시험의 기대값, 조회 지연 값(`LATENCY`)을 바꾸지 않는다.

## 원하는 결과
`npm run test:ci`를 반복 실행해도 `ci/archive.test.js`가 실패하지 않는다. 실패할 때 보이던 증상은 두 가지다.
- `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp` (실행마다 파일 이름은 다름)
- 가끔 함께 나오는 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`

로컬 `npm test`는 늘 통과한다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`, 특히 `node --test ci/archive.test.js` 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `node --test ci/archive.test.js`를 20회 연속 실행해 모두 통과한다
- [ ] 병렬 실행(동시 4개, `concurrency: 4`)이 그대로 유지된다
- [ ] 변경이 `ci/batch.test.js`가 다루는 동작에 닿지 않는다

## 제약
- (팀 지식 `docs/knowledge/testing/flaky-tests-fix-the-cause.md`) 간헐 실패는 재시도, skip, 시간 제한 증가, 순차 실행으로 덮지 않고 원인을 고친다. 병렬 실행(동시 4개, `concurrency: 4`)은 유지한다. 조회 지연 값(`LATENCY`)이나 시험의 기대값을 바꿔 증상을 가리지 않고 `src/`의 원인 코드를 고친다.

## 추가 의견
- 없음
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-k8/22-flaky-retry-k8-5/relay-home/projects/jobs-553a03/works/w-20261004-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 06:22 (사람 승인)
- [AI] 초안 우선으로 사람에게 묻지 않고 초안을 썼다 — 요청에 증상, 대상 시험, 범위 밖(batch.test.js)이 분명하고 업무 유형 bugfix가 요청과 맞다
- [AI] 간헐 실패를 덮지 않는 규칙을 제약으로 옮겼다 — 팀 지식 docs/knowledge/testing/flaky-tests-fix-the-cause.md가 사람이 정한 규칙이다

## t-02 fix — 2026-10-04 06:23 (자동 승인)
- [AI] 임시 파일 이름에 reportId를 넣는 방식으로 고친다 — 팀 지식 docs/knowledge/store/report-temp-file-name.md: 이름에 보고서마다 다른 값을 넣고 접두 . 와 접미 .tmp는 유지. 병렬 실행과 LATENCY는 건드리지 않음(docs/knowledge/testing/flaky-tests-fix-the-cause.md)
```

## 누적 기각 목록

- t-02 fix: runPool 결과 순서: 이 시험의 증상과 무관하고 수정 뒤 통과. batch.test.js 범위

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣는 방식으로 고친다"
    why: "팀 지식 docs/knowledge/store/report-temp-file-name.md: 이름에 보고서마다 다른 값을 넣고 접두 . 와 접미 .tmp는 유지. 병렬 실행과 LATENCY는 건드리지 않음(docs/knowledge/testing/flaky-tests-fix-the-cause.md)"
    by: ai
assumptions:
  - "reportId는 동시에 저장되는 보고서끼리 서로 다르다. 같은 reportId를 동시에 저장하는 경우는 다루지 않음"
rejected:
  - "runPool 결과 순서: 이 시험의 증상과 무관하고 수정 뒤 통과. batch.test.js 범위"
open_questions: []
intent_deviation: null
risks:
  - "runPool이 끝난 순서로 결과를 모으는 문제는 src/runner/pool.js에 그대로 있음. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "같은 reportId를 같은 ms에 동시에 저장하면 여전히 임시 이름이 겹침"
recommended_next: null
knowledge_candidates: []
---
## 요약
임시 파일 이름이 시각뿐이라 같은 ms에 시작한 동시 저장이 같은 임시 파일을 쓰던 것이 원인이다. 이름에 reportId를 넣어 고쳤고, 재현 시험을 추가했다. test:ci 67개 통과, archive 시험 30회 연속 통과.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:23`
- 재현 시험: `test/archive.test.js` 마지막 시험(시각 고정 + 동시 4개 저장). 수정 전 ENOENT로 실패.
- 수정 전 `ci/archive.test.js` 20회 중 11회 실패, 수정 후 30회 0회.
- 병렬 실행, LATENCY, 기존 시험은 변경 없음.
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e10-k8/22-flaky-retry-k8-5/relay-home/projects/jobs-553a03/works/w-20261004-002/tasks/02-fix/fix.md
