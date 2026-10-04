## docs/knowledge/runner/pool-result-order.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: investigation
anchor: runPool
---
# runPool 결과는 입력 순서여야 한다

## 규칙
- `runPool`(`src/runner/pool.js`)은 작업이 끝난 순서가 아니라 입력 순서대로 결과를 돌려준다. `collectResults`(`src/collect/collector.js`)가 `outcomes[i]`를 `jobs[i]`와 인덱스로 짝짓기 때문이다.
- 이를 어기면 조회 지연 jitter에 따라 보고서가 다른 작업에 붙는다 (`expected report-6 to belong to job-6, got job-5`).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/store/temp-file-unique-name.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# 동시에 쓰는 임시 파일 이름을 시각만으로 만들면 같은 ms에 겹친다

## 내용
- `saveReport`(`src/store/report-archive.js`)의 임시 파일 이름은 `.<reportId>.<stamp>.tmp`다. 시각만 쓰면 같은 ms에 동시에 저장하는 작업이 같은 파일을 덮어쓰거나 `rename`이 ENOENT로 실패한다.
- 동시에 쓰는 임시 파일 이름에는 고유 키(reportId)를 넣는다. 같은 reportId를 동시에 두 번 저장하는 경우는 보호하지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/testing/flaky-test-root-cause.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 간헐적으로 실패하는 시험은 재시도·skip·시간 제한 증가가 아니라 근본 원인을 고친다

## 규칙
- 간헐 실패(flaky)를 시험에 재시도를 붙이거나 skip하거나 시간 제한을 늘려 피하지 않는다. 근본 원인을 고친다.
- 병렬 실행(밤 배치 동시 4개)을 순차 실행으로 되돌려 문제를 피하지 않는다.
- 간헐 실패의 수정은 한 번 통과한 것으로 확인하지 않고 `npm run test:ci`를 여러 번 반복 실행해 확인한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
