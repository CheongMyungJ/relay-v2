## docs/knowledge/batch/flaky-test-policy.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 밤 배치는 병렬 4개를 유지하고, flaky 시험은 근본 원인을 고친다

## 규칙
- 배치 병렬 실행(동시 4개)은 유지한다. 순차 실행으로 되돌리는 것은 해결이 아니다.
- 간헐 실패하는 시험에 재시도, skip, 시간 제한 늘리기를 붙이지 않는다. 근본 원인을 고친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/batch/parallel-ordering-and-temp-names.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: runPool
---
# 병렬 실행에서 결과 순서와 임시 파일 이름이 겹치는 실패

## 내용
- `runPool`(src/runner/pool.js)의 결과는 입력 순서여야 한다. `collectResults`(src/collect/collector.js)가 index로 job과 짝짓기 때문에, 완료 순서로 쌓으면 `report-N`이 엉뚱한 job에 묶인다.
- 보관소 임시 파일 이름(src/store/report-archive.js `saveReport`)을 ms 시각만으로 만들면 동시 저장에서 겹친다. 저장마다 고유한 값(reportId와 호출마다 늘어나는 번호)을 붙인다. 점으로 시작하고 `.tmp`로 끝나는 형식은 유지한다.
- 두 원인 모두 동시 4개에서만 나타나므로 `npm run test:ci`를 반복 실행해 확인한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
