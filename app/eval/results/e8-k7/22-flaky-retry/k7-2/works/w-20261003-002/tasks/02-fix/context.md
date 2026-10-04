# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-2/relay-home/projects/jobs-535597/works/w-20261003-002/tasks/02-fix
- 작업 브랜치: relay/w-20261003-002
- 기준 브랜치: main
- 기준 커밋: 54b92803cd1365143036cd5aaf186882a49bba0e

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

#### docs/knowledge/archive-tmp-name-needs-unique-part.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 보관 임시 파일 이름에 ms 시각만 쓰면 동시 저장에서 겹친다

- 종류: 실패 유형
- 적용: src/store/report-archive.js (saveReport)
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

`.${stamp(now())}.tmp`처럼 ms 시각만으로 만든 임시 파일 이름은 같은 ms에 동시 저장하는 두 작업이 같은 파일을 써서,
뒤 작업의 rename이 `ENOENT`로 실패한다(ci/archive.test.js가 간헐 실패). 이름에 reportId 같은 고유 요소를 넣는다.
같은 reportId를 동시에 저장하는 경우까지는 막지 않는다. 임시 파일 이름 규칙에 의존하는 쪽(정산팀)이 있으면 확인한다.
```

#### docs/knowledge/batch-keeps-parallel-concurrency-4.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 배치는 병렬(동시 4개)로 실행한다. 순차 실행으로 되돌리는 것은 해결이 아니다

- 종류: 규칙
- 적용: src/runner/pool.js, src/runner/runner.js, src/config.js (concurrency 기본 4)
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

배치 결과가 어긋나거나 시험이 흔들릴 때 concurrency를 1로 낮추는 식의 순차 실행 복귀는 해결로 인정하지 않는다.
병렬(동시 4개)을 유지한 채 원인을 고친다. 예: runPool은 결과를 끝난 순서가 아니라 items의 인덱스 자리에 넣는다.
```

#### docs/knowledge/no-retry-skip-timeout-for-flaky-tests.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 간헐 실패 시험은 재시도·skip·시간 제한 증가가 아니라 원인을 고친다

- 종류: 규칙
- 적용: ci/, test/, 간헐 실패(flaky) 대응 전반
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

간헐 실패하는 시험에 재시도를 붙이거나, skip하거나, timeout을 늘리는 것은 해결로 인정하지 않는다.
시험의 검증을 약화하는 것도 마찬가지다. 원인을 찾아 제품 코드(또는 시험의 잘못된 가정)를 고친다.
예: `expected report-6 to belong to job-6, got job-5`는 시간 문제가 아니라 결과 순서 문제였다 (src/runner/pool.js).
로컬 `npm test`는 ci/를 포함하지 않아 늘 통과하므로, 재현은 `npm run test:ci`를 여러 번(예: 20회) 반복한다.
```

#### docs/knowledge/runpool-results-in-items-order.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# runPool 결과는 items 순서여야 한다

- 종류: 실패 유형
- 적용: src/runner/pool.js, src/collect/collector.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

collectResults가 결과를 인덱스로 작업과 짝짓는다. runPool이 결과를 끝난 순서로 push하면 지연 순서에 따라
report가 다른 job에 붙는다(report-2가 job-1 소속으로 보임). 지연이 없는 로컬 환경에서는 드러나지 않는다.
결과는 `results[start + i]`처럼 items 인덱스 자리에 넣는다. 병렬 실행 자체는 바꾸지 않는다.
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
CI의 `npm run test:ci`에서 ci/archive.test.js(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 시험)가 간헐적으로 실패하는 원인을 찾아 고친다.

## 비목표
- ci/batch.test.js의 간헐 실패 (별도 Work에서 리뷰 중)
- 배치 실행 방식(병렬 동시 4개)을 바꾸는 것

## 원하는 결과
ci/archive.test.js가 반복 실행해도 안정적으로 통과한다. 보관소에는 각 보고서가 올바른 고객사 내용으로 남고, 아래 두 실패가 더 나오지 않는다.
- `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp` (주로 나타남)
- `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)` (가끔 함께 나타남)

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (`npm run test:ci`를 20회 반복해 ci/archive.test.js가 한 번도 실패하지 않는다)
- [ ] `npm test`와 `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] ci/archive.test.js의 검증 내용(보관본의 존재와 고객사 일치)이 그대로 유지된다
- [ ] 배치 동시 실행 수(기본 4)가 그대로다

## 제약
- (팀 지식 docs/knowledge/no-retry-skip-timeout-for-flaky-tests.md) 간헐 실패 시험은 재시도, skip, timeout 증가로 해결하지 않고 원인을 고친다. 시험 검증을 약화하는 것도 해결이 아니다.
- (팀 지식 docs/knowledge/batch-keeps-parallel-concurrency-4.md) concurrency를 1로 낮추는 순차 실행 복귀는 해결이 아니다. 병렬(동시 4개)을 유지한 채 고친다.
- 로컬 `npm test`는 ci/를 포함하지 않아 늘 통과한다. 재현은 `npm run test:ci` 반복으로 한다.

## 추가 의견
- 재실행하면 통과하는 간헐 실패다. 실패 로그는 그때그때 조금씩 다르다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-2/relay-home/projects/jobs-535597/works/w-20261003-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 12:17 (사람 승인)
- [AI] 배치 병렬 동시 4개 유지와 재시도/skip/timeout 증가 금지를 제약에 넣는다 — 팀 지식의 사람이 정한 규칙이며 이번 경우(간헐 실패, 시험 흔들림)에 해당한다
- [사람] ci/batch.test.js 간헐 실패는 비목표로 둔다 — 요청에서 별도 Work로 리뷰 중이라고 명시함
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "배치 병렬 동시 4개 유지와 재시도/skip/timeout 증가 금지를 제약에 넣는다"
    why: "팀 지식의 사람이 정한 규칙이며 이번 경우(간헐 실패, 시험 흔들림)에 해당한다"
    by: ai
  - what: "ci/batch.test.js 간헐 실패는 비목표로 둔다"
    why: "요청에서 별도 Work로 리뷰 중이라고 명시함"
    by: human
assumptions:
  - "재현은 `npm run test:ci` 20회 반복으로 확인한다 (팀 지식의 예시 횟수)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: runPool 결과 순서(src/runner/pool.js). 범위를 넓히지 않는다"
  - "docs/knowledge/는 이 브랜치에 아직 없다. 팀 지식 항목은 앞 Work에서 온 것이다"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js의 간헐 실패(`ENOENT ... .tmp`, 고객사 불일치) 원인을 찾아 고치는 bugfix 의도 초안을 썼다. 사람이 정한 규칙(재시도/skip/timeout 금지, 병렬 4 유지)은 제약에 옮겼다.
## 다음 task가 알아야 할 것
- 시험 스크립트: `npm run test:ci` (test/ + ci/), `npm test`는 ci/ 제외라 늘 통과한다.
- 참고(원인 근거 아님, 앞 Work 조사): 보관 임시 파일 이름의 고유성(`docs/knowledge/archive-tmp-name-needs-unique-part.md`, 적용 src/store/report-archive.js saveReport), 결과 순서(`docs/knowledge/runpool-results-in-items-order.md`). 이 브랜치에는 이 문서들이 없고 코드가 현재 상태와 다를 수 있으니 직접 확인한다.
- 위 사실이 이번 버그의 원인이라는 확인은 안 됨. fix에서 직접 재현해 판단한다.
```

## 필요한 산출물

없음
