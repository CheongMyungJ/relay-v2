## docs/knowledge/ci/flaky-test-policy.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 간헐 실패는 코드의 원인을 찾아 고친다. 시험을 약화하거나 병렬 실행을 줄이지 않는다

## 규칙
- 시험에 재시도를 붙이거나, skip하거나, 시간 제한을 늘리는 것은 간헐 실패의 해결이 아니다.
- 밤 배치의 병렬 실행(기본 동시 4개)은 유지한다. 순차 실행으로 되돌리는 것은 해결이 아니다.
- 간헐 실패를 고쳤다는 근거로 `npm run test:ci`와 해당 시험을 여러 번 반복 실행한 결과를 남긴다. 한 파일(`ci/batch.test.js`)이 안정돼도 `ci/archive.test.js` 등 다른 CI 시험이 같은 증상으로 따로 실패할 수 있으니 `test:ci` 전체를 반복한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/runner/run-pool-result-order.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: investigation
anchor: runPool
---
# runPool 결과는 입력 순서여야 한다

## 규칙
- `runPool`(src/runner/pool.js)은 끝나는 순서가 아니라 `items`와 같은 순서로 결과를 돌려준다. `collectResults`(src/collect/collector.js)가 `outcomes[i]`를 `jobs[i]`의 결과로 인덱스로 짝짓기 때문이다.
- 조회 지연이 있는 환경(CI)에서만 어긋나므로, 순서는 지연이 다른 작업으로 시험한다(test/pool.test.js).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/store/report-temp-file-name.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: saveReport
---
# 보고서 임시 파일 이름은 보고서마다 달라야 한다

## 내용
- `saveReport`(src/store/report-archive.js)는 임시 파일에 쓴 뒤 `rename`한다. 임시 이름이 시각 꼬리표(`stamp(now())`)뿐이면 같은 ms에 동시에 저장하는 보고서끼리 같은 파일을 써서, 다른 고객사 내용이 보관되거나 `ENOENT`가 난다(`ci/archive.test.js`가 간헐 실패). 지금은 `.<reportId>.<stamp>.tmp`를 쓴다.
- 병렬 실행(동시 4개)에서 공유하는 자원의 이름을 시각만으로 만들지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
