## docs/knowledge/runner/pool-result-order.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: runPool
---
# runPool 결과 순서와 보고서 임시 파일 이름 겹침

## 내용
- `runPool`(src/runner/pool.js)의 결과는 입력 순서여야 한다. `collectResults`(src/collect/collector.js)가 인덱스로 job과 짝짓기 때문에, 완료 순서로 모으면 지연에 따라 `report-N`이 다른 job에 붙는다(`expected report-6 to belong to job-6, got job-5`).
- `saveReport`(src/store/report-archive.js)의 임시 파일 이름은 동시 저장끼리 겹치지 않아야 한다. 시각(ms)만으로는 부족해 reportId와 호출별 번호를 넣는다. 겹치면 ENOENT나 덮어쓰기가 난다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/testing/flaky-test-policy.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 간헐 실패하는 시험은 재시도·skip·시간 제한 증가가 아니라 근본 원인을 고친다

## 규칙
- 시험에 재시도를 붙이거나, skip하거나, 시간 제한을 늘리는 것은 간헐 실패의 해결이 아니다. 제품 코드의 근본 원인을 고친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
