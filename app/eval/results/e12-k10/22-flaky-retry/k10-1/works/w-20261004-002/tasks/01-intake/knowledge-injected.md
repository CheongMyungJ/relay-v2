## docs/knowledge/batch/nightly-batch-concurrency.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: DEFAULTS
---
# 밤 배치는 동시 4개 병렬 실행을 유지한다

## 규칙
- 밤 배치의 기본 동시 실행 수는 4(`src/config.js`의 `DEFAULTS.concurrency`)로 유지한다. 순차 실행으로 되돌리거나 동시 수를 줄이면 밤 배치가 제시간에 끝나지 않는다.
- flaky 시험은 재시도, skip, 시간 제한 늘리기로 해결하지 않는다. 진짜 원인을 코드에서 고친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/batch/pool-order-and-tmp-names.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# 병렬 실행에서 순서와 임시 파일 이름을 가정하지 말 것

## 내용
- `runPool`(src/runner/pool.js)의 결과는 완료 순서가 아니라 items 순서여야 한다. `collectResults`가 인덱스로 job과 짝짓기 때문에, 지연 지터로 완료 순서가 바뀌면 report가 다른 job에 붙는다. 지연이 없는 로컬 `npm test`는 통과하고 지연을 쓰는 `npm run test:ci`에서만 간헐 실패한다.
- 임시 파일 이름을 ms 시각만으로 만들면 동시 저장끼리 겹친다(src/store/report-archive.js). 지금은 reportId를 함께 쓴다. 같은 reportId를 같은 ms에 동시 저장하면 여전히 겹칠 수 있다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
