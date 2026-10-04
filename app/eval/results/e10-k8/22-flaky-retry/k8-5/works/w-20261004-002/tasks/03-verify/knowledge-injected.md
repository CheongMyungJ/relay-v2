## docs/knowledge/runner/run-pool-result-order.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: investigation
anchor: runPool
---
# runPool 결과는 끝난 순서가 아니라 items 순서와 같아야 한다

## 규칙
- `runPool(items, ...)`이 돌려주는 배열의 i번째는 `items[i]`의 결과다. `collectResults`(`src/collect/collector.js`)가 `outcomes[i]`를 `jobs[i]`와 index로 짝짓기 때문이다.
- 지연이 없는 로컬 `npm test`는 완료 순서가 입력 순서와 거의 같아 어겨도 통과한다. 지연이 있는 `npm run test:ci`에서만 가끔 실패한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/store/report-temp-file-name.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: saveReport
---
# 보고서 임시 파일 이름은 시각만으로 만들면 동시 저장끼리 겹친다

## 내용
- `saveReport`(`src/store/report-archive.js`)는 임시 파일에 쓴 뒤 rename한다. 이름이 `stamp(now())`뿐이면 같은 ms에 시작한 동시 저장(동시 4개)이 같은 임시 파일을 쓴다. 한쪽이 rename하면 다른 쪽은 ENOENT로 실패하고, 겹쳐 쓰면 보관본에 다른 고객사의 내용이 들어간다.
- 임시 이름에는 보고서마다 다른 값(`reportId`)을 넣는다. 접두 `.`와 접미 `.tmp`는 `listReports`와 `strayTemps`가 쓰므로 유지한다.
- 재현은 `node --test ci/archive.test.js` 반복 실행(수정 전 20회 중 5회 실패).

## docs/knowledge/testing/flaky-tests-fix-the-cause.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 간헐 실패는 재시도·skip·시간 제한 증가·순차 실행으로 덮지 않고 원인을 고친다

## 규칙
- 시험이 가끔 실패하면 재시도를 붙이거나, skip하거나, 시간 제한을 늘리지 않는다.
- 순차 실행으로 되돌리는 것도 해결이 아니다. 병렬 실행(동시 4개, `concurrency: 4`)은 유지한다.
- 조회 지연 값(`LATENCY`)이나 시험의 기대값을 바꿔 증상을 가리지 않는다. `src/`의 원인 코드를 고친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
