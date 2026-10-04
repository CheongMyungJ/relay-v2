# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-4/relay-home/projects/jobs-3fa437/works/w-20261003-002/tasks/03-verify
- 작업 브랜치: relay/w-20261003-002
- 기준 브랜치: main
- 기준 커밋: 5d3bf9fb88624b38399a1f082445676e42a6c847

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
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/keep-parallel-concurrency-4.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 병렬 실행(동시 4개)은 유지한다. 순차로 되돌려 해결하지 않는다

- 종류: 규칙
- 적용: src/config.js (concurrency 기본 4), src/runner/pool.js
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

경쟁이나 순서 문제는 동시성을 낮춰 피하지 말고 원인(순서 가정, 공유 자원)을 고친다.
```

#### docs/knowledge/no-retry-skip-timeout-for-flaky.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 간헐 실패는 재시도·skip·시간 제한 늘리기로 해결하지 않는다

- 종류: 규칙
- 적용: ci/, test/ 전반
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

간헐 실패(재실행하면 통과)는 시험에 재시도를 붙이거나, skip하거나, 시간 제한을 늘려 덮지 않는다.
타이밍에 의존하는 원인을 소스 코드에서 찾아 고친다.
시험의 검증 내용을 약화하는 것도 해결이 아니다.
```

#### docs/knowledge/pool-results-in-items-order.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# runPool 결과는 완료 순서가 아니라 items 순서여야 한다

- 종류: 실패 유형
- 적용: 관련 위치 src/runner/pool.js, src/collect/collector.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

collectResults는 outcomes[i]와 jobs[i]를 짝짓는다고 가정한다. 끝나는 순서대로 push하면 지연이 다를 때 report-N이 다른 job에 붙는다.
증상: `expected report-6 to belong to job-6, got job-5` (ci/batch.test.js, 조회 지연 지터 때문에 가끔만).
test/는 지연이 없어 못 잡는다. 결정적 시험은 지연을 [30,1,15,5]처럼 고정한다.
```

#### docs/knowledge/report-temp-file-name-must-be-unique.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 보고서 임시 파일 이름은 작업마다 달라야 한다 (시각만으로는 겹친다)

- 종류: 실패 유형
- 적용: 관련 위치 src/store/report-archive.js (saveReport), src/util/ids.js (stamp)
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

같은 폴더에 동시(4개) 저장하면 같은 ms에 시작한 저장들이 시각 꼬리표만 쓴 임시 이름을 공유해 서로의 내용을 덮어쓴다.
증상: ci/archive.test.js에서 보관본의 고객사가 다름(expected 'stark', actual 'wayne'), 임시 파일 잔존. test/는 시계를 가짜로 써 못 잡는다.
임시 이름에는 reportId처럼 작업마다 다른 값을 넣는다. 결정적 시험은 sleep을 멈춰 같은 시각을 만든다.
```

### 지식 남기기 (이 단계에서 할 일)

공통 종료 절차의 커밋 전에, 이 Work에서 알게 된 것 가운데 다음 일에도 쓸 사실을 레포의 `docs/knowledge/`에 남기고 코드와 함께 커밋한다. 팀이 PR로 함께 보고, 다음 일의 에이전트가 읽는다. 재료는 아래 지식 후보, Work 요청 원문(`request.md`), intent의 `비목표`와 `제약`, 결정 로그의 사람 결정(`by: human`), 이 task에서 사람이 한 말이다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(언제 무엇을 왜 바꿨나 등), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치.
- 사람이 요청이나 답에서 이번 일을 넘어 통하는 규칙을 말했으면(예: "금액은 늘 원 단위로 내림한다", "외부 API 응답은 캐시하지 않는다"), intent에 이번 Work의 비목표나 제약으로 들어가 있어도 지식으로 남긴다. 다음 일의 사람은 같은 말을 다시 하지 않아도 되어야 한다.
- 규칙과 사실, 그 까닭을 쓴다. 코드의 지금 모양(어느 함수가 무엇을 쓰는지)은 이 Work가 바꿨을 수 있고 기준 브랜치에는 아직 없을 수 있으니 "관련 위치"로만 적고 "이렇게 되어 있다"고 쓰지 않는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 항목은 만들지 않는다(다음 일이 같은 것을 다시 묻게 만든다).
- 지식 후보 가운데 "(사람)"이 붙은 것은 이번 일에만 해당하지 않는 한 모두 남긴다.
- 사람이 알려 준 규칙은 하나도 빠뜨리지 않는다. 규칙이 여럿이면(예: 계산 규칙과 적용 순서) 항목을 나눈다.
- 한 항목에 파일 하나. 파일 이름은 내용을 나타내는 영어 소문자와 `-` (예: `no-cache-external-api.md`). 같은 내용의 파일이 이미 있으면 새로 만들지 말고 그 파일을 고친다.
- 무엇이 맞고 무엇이 틀린지, 예와 수치를 적는다. 다음 사람이 이 파일만 읽고 따를 수 있어야 한다.
- 위 항목 가운데 "기준 브랜치에는 아직 없다"고 적힌 것은 이 worktree에 파일이 없다. 그 항목을 고쳐야 할 때만 같은 경로에 앞 내용을 모두 살려 고친 파일을 쓰고(머지하면 이 Work의 파일이 남는다), 고칠 것이 없으면 그 파일을 만들지 않는다.
- 남긴 파일은 handoff의 `## 요약` 끝에 "남긴 지식: <경로>"로 적는다. 남길 것이 없으면 "남긴 지식: 없음 (까닭)"으로 적는다. 앱이 이 줄을 확인한다.

파일 형식:

```markdown
# <한 줄 제목: 규칙이나 사실>

- 종류: 규칙 | 사실 | 이력 | 실패 유형
- 적용: <관련 경로나 영역>
- 출처: <사람이 알려 줌 / 조사로 알아냄>, relay Work w-20261003-002, 2026-10-03

<본문: 5줄 안팎>
```

#### 앞 task들의 지식 후보

- t-02 fix: report-N 임시 파일 충돌의 원인은 src/store/report-archive.js saveReport의 시각만 쓴 임시 이름이었고, reportId를 넣어 고쳤다. 결정적 시험은 setSleep을 no-op으로 해 시각을 멈춘다.

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
`npm run test:ci`에서 `ci/archive.test.js`가 가끔 실패하는 문제를 없앤다. 재실행하면 통과하는 간헐 실패이며, 밤 배치 뒤 보고서가 보관소에 제대로 남아야 한다.

## 비목표
- `ci/batch.test.js`의 간헐 실패 (따로 고쳐 리뷰 중)
- 동시 실행 수(concurrency) 변경
- 시험에 재시도, skip, 시간 제한 늘리기를 붙이는 것

## 원하는 결과
`ci/archive.test.js`를 반복 실행해도 실패하지 않는다. 보관된 보고서마다 해당 고객사의 내용이 남고, `reports/` 아래에 임시 파일이 남지 않는다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (`ci/archive.test.js`를 반복 실행해도 `ENOENT ... .tmp`와 `보관본의 고객사가 다르다` 오류가 나오지 않는다)
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 로컬 `npm test`도 계속 통과한다
- [ ] 이 간헐 실패를 결정적으로 재현하는 시험이 추가되어, 수정 전에는 실패하고 수정 후에는 통과한다

## 제약
- (팀 지식 `docs/knowledge/keep-parallel-concurrency-4.md`) 병렬 실행(동시 4개)은 유지한다. 경쟁이나 순서 문제는 동시성을 낮춰 피하지 말고 원인을 고친다.
- (팀 지식 `docs/knowledge/no-retry-skip-timeout-for-flaky.md`) 간헐 실패는 시험에 재시도를 붙이거나 skip하거나 시간 제한을 늘려 덮지 않는다. 시험의 검증 내용을 약화하는 것도 해결이 아니다. 타이밍에 의존하는 원인을 소스 코드에서 찾아 고친다.

## 추가 의견
- 실패 로그 예: `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`, `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`. 로컬 `npm test`는 늘 통과한다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-4/relay-home/projects/jobs-3fa437/works/w-20261003-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 13:04 (사람 승인)
- [AI] 동시성 유지, 재시도/skip/시간 제한 금지를 비목표와 제약에 넣음 — 팀 지식의 사람 규칙(keep-parallel-concurrency-4, no-retry-skip-timeout-for-flaky)이 이번 경우에 해당함

## t-02 fix — 2026-10-03 13:05 (자동 승인)
- [AI] 임시 파일 이름에 reportId를 넣어 고친다. 동시성은 그대로 둔다 — 팀 지식 docs/knowledge/report-temp-file-name-must-be-unique.md, keep-parallel-concurrency-4.md. 이 코드에서 원인을 실험으로 확인함
```

## 누적 기각 목록

없음

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣어 고친다. 동시성은 그대로 둔다"
    why: "팀 지식 docs/knowledge/report-temp-file-name-must-be-unique.md, keep-parallel-concurrency-4.md. 이 코드에서 원인을 실험으로 확인함"
    by: ai
assumptions:
  - "ci/batch.test.js 간헐 실패는 기준 커밋에서 따로 실행해 확인하지 않았고 pool 순서 문제로 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "npm run test:ci는 ci/batch.test.js 간헐 실패(비목표) 때문에 가끔 실패한다. 완료조건 'test:ci 통과'는 그 수정이 머지되어야 안정적으로 만족됨"
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: src/runner/pool.js 순서"
recommended_next: null
knowledge_candidates:
  - "report-N 임시 파일 충돌의 원인은 src/store/report-archive.js saveReport의 시각만 쓴 임시 이름이었고, reportId를 넣어 고쳤다. 결정적 시험은 setSleep을 no-op으로 해 시각을 멈춘다."
---
## 요약
saveReport의 임시 파일 이름이 시각만 써서 동시 저장이 겹치던 것을 reportId를 넣어 고쳤다. 결정적 재현 시험을 추가했고 수정 전 실패, 수정 후 통과를 확인했다.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js` saveReport의 tmp 이름. 시험: `test/archive.test.js` 새 시험.
- `npm test` 63 통과. `node --test ci/archive.test.js` 15회 무실패.
- `npm run test:ci`는 ci/batch.test.js(비목표)가 약 30% 실패. archive는 실패 없음.
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-4/relay-home/projects/jobs-3fa437/works/w-20261003-002/tasks/02-fix/fix.md
