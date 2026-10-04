## docs/knowledge/flaky-test-policy.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# flaky 시험은 우회하지 않고 원인을 찾아 고치고, 배치 병렬 실행(동시 4개)은 유지한다

## 규칙
- flaky 시험은 재시도, skip, 시간 제한 늘리기로 해결하지 않는다. 원인을 찾아 제품 코드(실제 결함이 있는 곳)에서 고친다.
- 배치의 병렬 실행(기본 동시 4개, src/config.js)은 유지한다. 순차 실행으로 되돌리는 것은 해결이 아니다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/runner/run-pool-result-order.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: investigation
anchor: runPool
---
# runPool은 결과를 입력 순서대로 돌려준다

## 규칙
- `runPool`(src/runner/pool.js)의 결과 배열은 완료 순서가 아니라 입력 순서여야 한다. `collectResults`(src/collect/collector.js)가 인덱스로 job과 결과를 짝짓기 때문이다.
- 지연이 없는 로컬 시험에서는 완료 순서 = 입력 순서라 어긋남이 가려지고, 지연이 있는 `ci/batch.test.js`에서만 가끔 드러난다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
