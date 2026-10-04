## docs/knowledge/runner/pool-result-order.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: runPool
---
# runPool 결과는 입력 순서여야 하고, test:ci에는 보관소 임시 파일 충돌도 있었다

## 내용
- `runPool`(src/runner/pool.js)의 결과는 입력 순서여야 한다. `collectResults`가 인덱스로 작업과 짝짓는다. 끝난 순서로 `push`하면 지연이 있을 때 report-N이 다른 job에 붙는다. 로컬 `npm test`는 지연이 없어 통과하므로 `ci/`의 지연 시험에서만 드러난다.
- `saveReport`(src/store/report-archive.js)의 임시 파일 이름이 시각뿐이면 같은 ms에 동시에 저장하는 보고서끼리 겹친다. 지금은 `.reportId.stamp.tmp`다. 같은 reportId를 같은 ms에 두 번 저장하면 여전히 겹친다.
- `ci/archive.test.js`의 간헐 실패(`ENOENT ... .tmp`)가 이 충돌이다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/testing/flaky-test-fix-policy.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# flaky 시험은 우회하지 않고 원인을 찾아 고친다

## 규칙
- 시험에 재시도, skip, 시간 제한 늘리기를 넣는 것은 flaky 해결이 아니다. 제품 코드의 원인을 찾아 고친다.
- 병렬 실행(동시 4개)을 순차 실행으로 되돌리거나 동시성 수를 줄이는 것은 해결이 아니다. 병렬은 유지한다.
- 고쳤다는 근거로 반복 실행 결과(횟수와 통과 수)를 보고한다. 예: `ci/batch.test.js` 20회 중 20회 통과.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
