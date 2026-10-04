## docs/knowledge/runner/runpool-result-order.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: runPool
---
# runPool 결과는 입력 순서여야 한다

## 내용
- `runPool` 결과는 완료 순서가 아니라 입력 순서다. `collectResults`가 `jobs[i]`와 `outcomes[i]`를 인덱스로 짝짓기 때문이다.
- 지연이 없는 로컬 `npm test`는 완료 순서가 입력 순서와 같아 이 버그를 못 잡는다. 지연과 jitter가 있는 `ci/batch.test.js`에서만 간헐 실패(`expected report-6 to belong to job-6, got job-5`)한다.
- 순서를 뒤바꾸는 지연을 쓰는 `test/pool.test.js`가 결정적으로 막는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/testing/flaky-tests-fix-cause.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 간헐 실패 시험은 원인을 코드에서 고친다

## 규칙
- 간헐 실패 시험을 재시도, skip, 시간 제한(timeout) 증가, 기대값 완화로 덮지 않는다. 그것은 해결이 아니다.
- 원인을 찾아 코드에서 고치고, 원인을 결정적으로 막는 단위 시험을 추가한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
