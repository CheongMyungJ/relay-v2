# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-3/relay-home/projects/jobs-676026/works/w-20261003-002/tasks/02-fix
- 작업 브랜치: relay/w-20261003-002
- 기준 브랜치: main
- 기준 커밋: 0705ba4fccfd21b51288c86bc087591fdeebfcae

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
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/keep-parallel-concurrency.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 병렬 실행(동시 4개)을 줄이거나 순차로 되돌리는 것은 간헐 실패의 해결이 아니다

- 종류: 규칙
- 적용: src/runner/pool.js, src/nightly.js
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

간헐 실패가 동시성에서 드러나도 동시성(4개)을 낮추거나 순차로 되돌려 가리지 않는다. 동시 실행에서도 맞게 동작하도록 코드를 고친다.
```

#### docs/knowledge/no-retry-skip-for-flaky-tests.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 간헐적으로 실패하는 시험은 재시도·skip·시간 제한 증가로 풀지 않고 코드에서 원인을 고친다

- 종류: 규칙
- 적용: ci/, test/ 전체
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

시험이 가끔 실패하면 재시도를 붙이거나, skip하거나, 시간 제한을 늘리는 것은 해결이 아니다. 지연(타이밍)에 따라 드러나는 원인을 src/에서 찾아 고친다.
예: `ci/batch.test.js`의 `expected report-6 to belong to job-6, got job-5`는 runPool이 완료 순서로 결과를 모아서 생긴 버그였다.
```

#### docs/knowledge/pool-results-keep-input-order.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# runPool 결과는 입력 순서와 같아야 하고, 보고서 임시 파일 이름은 reportId를 포함해야 한다

- 종류: 실패 유형
- 적용: 관련 위치 src/runner/pool.js, src/collect/collector.js, src/store/report-archive.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

- collectResults는 index로 job과 결과를 짝짓는다. runPool이 완료 순서로 결과를 모으면 지연이 다를 때 report-6이 job-5에 붙는다. 로컬 `npm test`는 지연이 없어 통과하므로 `ci/`에서만 가끔 실패한다.
- saveReport 임시 파일 이름이 ms 시각뿐이면 같은 ms에 시작한 동시 저장이 같은 임시 파일을 써서 ENOENT나 내용 뒤바뀜이 난다. reportId를 이름에 넣는다.
```

### 지식 후보 남기기

handoff의 `knowledge_candidates`에, 이 task에서 알게 된 것 가운데 다음 일에도 쓸 사실을 한 줄에 하나씩 적는다. 다음 verify가 이것을 보고 레포에 지식으로 남긴다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(예: 업무 규정, 팀이 정한 방식, 언제 무엇을 왜 바꿨나), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치. 사람이 말한 것은 뜻을 살려 그대로 적고 끝에 "(사람)"을 붙인다.
- 사람이 요청이나 답에서 "늘 이렇게 한다", "이건 해결이 아니다"처럼 이번 일을 넘어 통하는 규칙을 말했으면, 이번 Work의 비목표나 제약으로 옮겼더라도 후보로 적는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 메모도 후보가 아니다.

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
`npm run test:ci`에서 `ci/archive.test.js`가 간헐적으로 실패하는 문제를 없앤다. 밤 배치 뒤 보고서가 보관소에 정확히 남아야 하고, 동시 실행에서도 항상 그래야 한다.

## 비목표
- `ci/batch.test.js`의 간헐 실패 (따로 고쳐서 리뷰 중)
- 동시성(4개)을 낮추거나 순차로 되돌리는 것

## 원하는 결과
`ci/archive.test.js`가 반복 실행해도 `ENOENT: 파일이 없습니다: reports/2026-09/*.tmp`나 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)` 없이 늘 통과한다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (`ci/archive.test.js`를 여러 번 반복 실행해도 통과한다)
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm test`가 계속 통과한다
- [ ] 시험에 재시도, skip, 시간 제한 증가를 넣지 않고 `src/`의 원인을 고친다

## 제약
- (팀 지식 docs/knowledge/keep-parallel-concurrency.md) 간헐 실패가 동시성에서 드러나도 동시성(4개)을 낮추거나 순차로 되돌려 가리지 않는다. 동시 실행에서도 맞게 동작하도록 코드를 고친다.
- (팀 지식 docs/knowledge/no-retry-skip-for-flaky-tests.md) 간헐 실패 시험은 재시도, skip, 시간 제한 증가로 풀지 않고 지연(타이밍)에 따라 드러나는 원인을 src/에서 찾아 고친다.

## 추가 의견
- 로컬 `npm test`는 늘 통과하고 CI 전용 시험에서만 가끔 실패하며, 재실행하면 통과한다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-3/relay-home/projects/jobs-676026/works/w-20261003-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 12:42 (사람 승인)
없음
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "동시성 4개 유지와 재시도/skip 금지는 팀 지식 규칙을 제약으로 옮겼고 사람에게 다시 묻지 않음"
  - "`npm test`는 test/ 만 돌리므로 완료조건에 `npm run test:ci`를 기본 테스트 명령으로 씀"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 원인(runPool 결과 순서, 임시 파일 이름)은 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기. 이 브랜치에는 docs/knowledge/가 아직 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js 간헐 실패(ENOENT 임시 파일, 보관본 고객사 뒤바뀜)를 고치는 bugfix 의도 초안을 썼다. batch.test.js는 비목표다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm run test:ci` (test/ + ci/), 로컬은 `npm test`.
- 참고 팀 지식(조사 사실, 이번 원인으로 확정 아님): `docs/knowledge/pool-results-keep-input-order.md`. 관련 위치 `src/runner/pool.js`, `src/collect/collector.js`, `src/store/report-archive.js`.
- 가설(참고용): saveReport 임시 파일 이름에 reportId가 없어 같은 ms의 동시 저장이 충돌했을 수 있음. 확인 안 됨.
```

## 필요한 산출물

없음
