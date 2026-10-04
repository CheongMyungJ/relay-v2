## docs/knowledge/batch/ordering-and-tmp-file-pitfalls.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

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

## docs/knowledge/batch/parallel-concurrency-must-stay.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 배치의 병렬 실행(동시 4개)은 유지한다

## 규칙
- 배치의 병렬 실행(동시 4개)을 순차 실행으로 되돌리지 않는다. 순서나 충돌 문제는 병렬을 끄지 않고 원인을 고쳐 해결한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/testing/flaky-test-fix-policy.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

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
