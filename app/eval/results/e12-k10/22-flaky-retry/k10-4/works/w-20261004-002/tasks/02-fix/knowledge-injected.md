## docs/knowledge/runner/runpool-order-and-concurrency.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: runPool
---
# runPool은 결과를 입력 순서로 돌려주고 병렬 실행을 유지한다

## 규칙
- `runPool`(`src/runner/pool.js`)의 결과 배열은 입력 `items`와 같은 순서여야 한다. `collectResults`(`src/collect/collector.js`)가 인덱스로 작업과 결과를 짝짓기 때문에, 완료 순서로 쌓으면 조회 지연 때 보고서가 옆 작업에 붙는다(`report-N`이 `job-N-1`에 붙는 증상).
- 배치 병렬 실행(동시 4개)은 유지한다. 순차 실행으로 되돌리거나 동시 실행 수를 줄이는 것은 순서 문제의 해결이 아니다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/testing/flaky-test-policy.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# flaky 시험은 재시도, skip, 시간 제한 늘리기로 해결하지 않는다

## 규칙
- 간헐적으로 실패하는 시험은 재시도, skip, 시간 제한 늘리기, 지연 설정 줄이기로 가리지 않는다. 제품 동작의 원인을 찾아 고치고, 실패 조건을 결정적으로 재현하는 회귀 시험을 `npm test`에 추가한다.
- 예: `ci/batch.test.js`의 `report-N belongs to job-N` 실패는 시험이 아니라 `runPool`의 결과 순서 문제였다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
