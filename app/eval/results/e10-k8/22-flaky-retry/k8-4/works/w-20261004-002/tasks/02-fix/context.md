# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-k8/22-flaky-retry-k8-4/relay-home/projects/jobs-ca4ce8/works/w-20261004-002/tasks/02-fix
- 작업 브랜치: relay/w-20261004-002
- 기준 브랜치: main
- 기준 커밋: f146495d2982771609e04922d14f8abc8edb8369

## 승인 방식

자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례는 수정 방향을 정할 때 따르고 `decisions`에 남긴다(`by: ai`, `why`에 항목 경로). 실패 유형은 먼저 확인해 볼 가설로 쓰고, 이 코드에서 확인한 뒤에만 원인으로 삼는다.
- "기준 브랜치에는 아직 없다"고 적힌 항목은 머지를 기다리는 앞 Work에서 왔다. 그 Work가 고친 코드는 이 브랜치에 아직 없다. 같은 규칙을 어기는 코드가 이번 요청 밖에서 보이면 앞 Work가 이미 고친 곳일 수 있으니, 범위를 넓히지 말고 handoff의 `risks`에 "앞 Work(<id>)에서 고쳤을 수 있음, 머지 대기"로 적는다.
- 항목의 `## 규칙`(또는 `## 내용`)만 규칙과 사실이다. `## 아직 규칙을 따르지 않는 곳`은 아직 고치지 않은 코드, 곧 고칠 대상이다. 그 절이 없는 옛 형식의 항목은 글 전체를 읽는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/batch/ordering-and-tmp-file-pitfalls.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: pitfall
source: investigation
---
# 배치 결과 순서와 보관소 임시 파일 이름의 동시성 함정

## 내용
- `runPool`(src/runner/pool.js) 결과는 items 입력 순서여야 한다. `collectResults`(src/collect/collector.js)가 인덱스로 job과 결과를 짝짓는다. 끝난 순서로 push하면 지연이 다를 때 `expected report-N to belong to job-N` 실패가 난다.
- 보관소 임시 파일 이름(src/store/report-archive.js)은 동시 저장끼리 겹치지 않아야 한다. 시각 꼬리표만으로는 같은 ms에 충돌한다. 지금은 reportId를 넣었다.
- 로컬 `npm test`는 지연이 없어 늘 통과한다. 이 두 문제는 지연·jitter를 쓰는 `ci/` 시험(`npm run test:ci`)에서만 드러난다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/batch/parallel-concurrency-must-stay.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
---
# 배치의 병렬 실행(동시 4개)은 유지한다

## 규칙
- 배치의 병렬 실행(동시 4개)을 순차 실행으로 되돌리지 않는다. 순서나 충돌 문제는 병렬을 끄지 않고 원인을 고쳐 해결한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/testing/flaky-test-fix-policy.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
---
# 간헐 실패는 원인을 고치고 반복 실행으로 근거를 보인다

## 규칙
- 시험에 재시도 추가, skip, 시간 제한 늘리기는 간헐 실패의 해결이 아니다. 근본 원인을 고친다.
- 고쳤다는 근거는 `npm run test:ci`를 여러 번 반복 실행한 결과(실행 횟수와 통과 횟수)로 보여 준다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

### 지식 후보 남기기

handoff의 `knowledge_candidates`에, 이 task에서 알게 된 것 가운데 다음 일에도 쓸 사실을 한 줄에 하나씩 적는다. 다음 verify가 이것을 보고 레포에 지식으로 남긴다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(예: 업무 규정, 팀이 정한 방식, 언제 무엇을 왜 바꿨나), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치. 사람이 말한 것은 뜻을 살려 그대로 적고 끝에 "(사람)"을 붙인다.
- 사람이 요청이나 답에서 "늘 이렇게 한다", "이건 해결이 아니다"처럼 이번 일을 넘어 통하는 규칙을 말했으면, 이번 Work의 비목표나 제약으로 옮겼더라도 후보로 적는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 메모도 후보가 아니다.
- 사람의 지금 말이 위 항목과 어긋나면(값이나 규칙이 바뀌었으면) "고칠 지식: <경로> — <새 내용> (사람)"으로 후보에 적는다. verify가 그 항목을 고친다.

## 선택 가능한 다음 단계

- 기본 다음 단계: verify (리뷰와 검증)
- 이전 단계: intake (의도 정리)

## intent (버전 1)

```markdown
---
schema_version: 1
version: 1
type: bugfix
---
## 목표
`npm run test:ci`의 `ci/archive.test.js`가 가끔 실패하는 문제를 고친다. 밤 배치 뒤 보고서가 보관소에 제대로 남아야 한다.

## 비목표
- `ci/batch.test.js`의 간헐 실패는 따로 고쳐 리뷰 중이므로 다루지 않는다.
- 배치의 병렬 실행(동시 4개)을 순차로 되돌리지 않는다.

## 원하는 결과
밤 배치를 몇 번을 돌려도 보고서가 모두 보관소에 저장되고, 보관본마다 제 고객사와 합계가 남는다. 임시 파일이 남지 않는다. 실패 때 보이던 `ENOENT: 파일이 없습니다: reports/2026-09/.<꼬리표>.tmp`와 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`이 나오지 않는다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm run test:ci`를 여러 번 반복 실행한 결과(실행 횟수와 통과 횟수)가 모두 통과로 제시된다
- [ ] `ci/archive.test.js`에 재시도 추가, skip, 시간 제한 늘리기를 하지 않는다
- [ ] 배치의 병렬 실행(동시 4개)이 그대로 유지된다

## 제약
- (팀 지식 `docs/knowledge/testing/flaky-test-fix-policy.md`) 시험에 재시도 추가, skip, 시간 제한 늘리기는 간헐 실패의 해결이 아니다. 근본 원인을 고치고, 근거는 `npm run test:ci` 반복 실행 결과(실행 횟수와 통과 횟수)로 보인다.
- (팀 지식 `docs/knowledge/batch/parallel-concurrency-must-stay.md`) 순서나 충돌 문제는 병렬을 끄지 않고 원인을 고쳐 해결한다.

## 추가 의견
- 로컬 `npm test`는 지연이 없어 늘 통과하므로 `ci/` 시험으로만 확인할 수 있다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-k8/22-flaky-retry-k8-4/relay-home/projects/jobs-ca4ce8/works/w-20261004-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 05:58 (사람 승인)
- [사람] 범위는 ci/archive.test.js 간헐 실패로 한정, batch.test.js는 제외 — 요청에서 batch.test.js는 따로 리뷰 중이라 범위 밖이라고 함
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "범위는 ci/archive.test.js 간헐 실패로 한정, batch.test.js는 제외"
    why: "요청에서 batch.test.js는 따로 리뷰 중이라 범위 밖이라고 함"
    by: human
assumptions:
  - "팀 지식의 규칙(병렬 유지, 재시도/skip/시간 늘리기 금지, 반복 실행 근거)이 이번 건에도 적용된다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 보관소 임시 파일 이름 충돌을 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js 간헐 실패를 고치는 bugfix intent 초안을 썼다. 질문 없이 요청과 팀 지식으로 작성했다.
## 다음 task가 알아야 할 것
- 참고 팀 지식(기준 브랜치에는 아직 없음): `docs/knowledge/batch/ordering-and-tmp-file-pitfalls.md` (임시 파일 이름 동시성 함정).
- 내 가설(참고용, 확인 안 됨): `src/store/report-archive.js`의 `saveReport`가 임시 파일 이름을 `stamp(now())`만으로 만들어 같은 시각 동시 저장끼리 겹칠 수 있다. 증상(ENOENT 임시 파일, 다른 고객사 보관본)과 맞아 보인다.
- 검증: `npm run test:ci` 반복 실행. 로컬 `npm test`는 지연이 없어 항상 통과한다.
```

## 필요한 산출물

없음
