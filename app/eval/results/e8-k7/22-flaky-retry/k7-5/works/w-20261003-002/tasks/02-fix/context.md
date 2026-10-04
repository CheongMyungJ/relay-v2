# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-5/relay-home/projects/jobs-60cf5a/works/w-20261003-002/tasks/02-fix
- 작업 브랜치: relay/w-20261003-002
- 기준 브랜치: main
- 기준 커밋: ff52f88fdc22da09556fdd624c9bb2ce7bf7a75d

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

#### docs/knowledge/ci-tests-expose-ordering-races.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# ci/ 시험은 지연 jitter로 완료 순서가 바뀔 때만 실패한다

- 종류: 실패 유형
- 적용: ci/batch.test.js, ci/archive.test.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

로컬 npm test는 지연이 없어 완료 순서가 입력 순서와 같아 늘 통과한다. 순서나 동시 시작 시각에 의존하는 버그는 npm run test:ci에서만 가끔 드러난다.
비슷한 사례: saveReport 임시 파일 이름이 같은 ms에 겹쳐 ci/archive.test.js가 간헐 실패했다(이름에 reportId를 넣어 고침).
확인은 ci 시험을 20회 이상 반복 실행한다.
```

#### docs/knowledge/keep-batch-parallelism.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 배치의 병렬 실행(동시 4개)은 flaky 해결을 위해 줄이거나 순차로 되돌리지 않는다

- 종류: 규칙
- 적용: src/runner/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

순차 실행으로 되돌리거나 동시 실행 수를 줄이는 것은 해결이 아니다. 병렬(기본 동시 4개)을 유지한 채 근본 원인을 고친다.
까닭: 순서 의존 버그는 병렬을 없애면 가려질 뿐 남아 있다.
```

#### docs/knowledge/no-flaky-workarounds.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# flaky 시험은 재시도, skip, 시간 제한 증가가 아니라 근본 원인을 고친다

- 종류: 규칙
- 적용: test/, ci/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

간헐 실패(재실행하면 통과)를 재시도, skip, timeout 증가, 지연 값이나 검증 완화로 넘기지 않는다.
src/ 코드의 원인을 찾아 고친다. 예: 'expected report-6 to belong to job-6, got job-5'는 시험이 아니라 runPool 순서 버그였다.
```

#### docs/knowledge/runpool-preserve-input-order.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# runPool 결과는 입력 순서여야 한다

- 종류: 규칙
- 적용: src/runner/pool.js, src/collect/collector.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

collectResults는 outcomes[i]가 jobs[i]의 결과라고 인덱스로 짝짓는다. 그래서 runPool은 완료 순서가 아니라 items 순서로 결과를 돌려줘야 한다.
틀린 예: 완료 순서로 results.push → 조회 지연 jitter로 같은 묶음 안 순서가 바뀌면 report-6이 job-5 기록에 붙는다.
맞는 예: results[start + i]에 넣는다. 회귀 시험: test/pool.test.js.
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
`npm run test:ci`에서 ci/archive.test.js가 간헐적으로 실패하는 문제를 근본 원인부터 고친다. 밤 배치 뒤 보고서가 보관소에 제대로 남아야 한다.

## 비목표
- ci/batch.test.js의 간헐 실패는 별도 Work에서 고쳐 리뷰 중이므로 다루지 않는다.
- 배치 병렬 실행(기본 동시 4개)을 줄이거나 순차로 되돌리지 않는다.

## 원하는 결과
ci/archive.test.js가 반복 실행해도 항상 통과한다. 보관본이 올바른 고객사의 것이고, 보관 중 임시 파일(`reports/2026-09/.*.tmp`)이 없어져 ENOENT가 나지 않는다.

## 완료조건
- [ ] 재현 절차(ci/archive.test.js 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다 (`npm test`도 통과한다)
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm run test:ci`를 20회 반복 실행해 모두 통과한다
- [ ] 시험 코드(test/, ci/)에서 재시도, skip, timeout 증가, 지연 값·검증 완화를 쓰지 않는다

## 제약
- (팀 지식 docs/knowledge/no-flaky-workarounds.md) 간헐 실패를 재시도, skip, timeout 증가, 지연 값이나 검증 완화로 넘기지 않고 src/ 코드의 원인을 찾아 고친다.
- (팀 지식 docs/knowledge/keep-batch-parallelism.md) src/runner/의 병렬 실행(기본 동시 4개)을 유지한 채 근본 원인을 고친다.

## 추가 의견
- 실패 로그는 매번 조금씩 다르다. 주로 `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`, 가끔 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`이 함께 나온다.
- 로컬 `npm test`는 늘 통과하고 CI에서만, 재실행하면 통과하는 간헐 실패다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-5/relay-home/projects/jobs-60cf5a/works/w-20261003-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 13:30 (사람 승인)
- [사람] ci/batch.test.js 간헐 실패와 병렬도 변경은 비목표로 둔다 — 요청이 batch 쪽은 따로 리뷰 중이라고 밝혔고, 팀 규칙이 병렬 유지를 요구함
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "ci/batch.test.js 간헐 실패와 병렬도 변경은 비목표로 둔다"
    why: "요청이 batch 쪽은 따로 리뷰 중이라고 밝혔고, 팀 규칙이 병렬 유지를 요구함"
    by: human
assumptions:
  - "완료조건의 반복 실행 횟수 20회는 팀 지식(ci 시험은 20회 이상 반복)에서 가져옴"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: runPool 결과 순서와 saveReport 임시 파일 이름 충돌 관련 코드가 이 브랜치에는 아직 없을 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js의 간헐 실패를 근본 원인부터 고치는 intent 초안을 썼다. 비목표는 batch.test.js와 병렬도 축소, 완료조건에는 test:ci 20회 반복 통과를 넣었다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test`, `npm run test:ci`(package.json). ci/archive.test.js, ci/batch.test.js가 ci 전용.
- 참고(원인 근거 아님, 앞 Work 조사): docs/knowledge/ci-tests-expose-ordering-races.md, docs/knowledge/runpool-preserve-input-order.md. 이 파일들은 기준 브랜치에 아직 없다.
- 가설(확인 안 됨): 로그의 .tmp ENOENT는 saveReport 임시 파일 이름 충돌, 고객사 불일치는 순서 의존 가능성. fix에서 코드로 확인할 것.
```

## 필요한 산출물

없음
