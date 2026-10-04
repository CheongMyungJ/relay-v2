## docs/knowledge/runner/concurrency-order-pitfalls.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# 동시 실행 + 지연에서만 드러나는 순서·이름 충돌 (ci/ 시험)

## 내용
- `runPool`(src/runner/pool.js)의 결과는 작업 완료 순서가 아니라 입력 순서여야 한다. `collectResults`가 인덱스로 job과 짝짓기 때문이다. 지연이 없는 `npm test`에서는 드러나지 않고 지연이 있는 `ci/` 시험(`npm run test:ci`)에서만 실패한다(`expected report-N to belong to job-N`).
- 보고서 임시 파일 이름은 reportId를 넣어 동시 저장 때 겹치지 않게 한다(`saveReport`, src/store/report-archive.js). 같은 reportId를 같은 ms에 동시에 저장하는 경우는 아직 막지 않았다.
- 간헐 실패 확인은 `node --test ci/batch.test.js`와 `npm run test:ci`를 여러 번 반복한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/testing/flaky-test-policy.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# flaky 시험은 재시도, skip, 시간 제한 늘리기로 가리지 않고 근본 원인을 고친다

## 규칙
- 간헐적으로 실패하는 시험은 시험에 재시도를 붙이거나, skip하거나, 시간 제한을 늘려 해결하지 않는다.
- 근본 원인을 찾아 원인이 되는 코드(src)에서 고친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
