## docs/knowledge/runner/pool-result-order.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: investigation
anchor: runPool
---
# runPool의 결과는 완료 순서가 아니라 items 순서다

## 규칙
- `runPool`은 결과를 items와 같은 인덱스에 담는다. `collectResults`가 인덱스로 작업과 짝짓기 때문이다(src/runner/pool.js, src/collect/collector.js).
- 끝난 순서대로 push하면 조회 지연 jitter에서 report가 다른 job에 붙는다(`expected report-6 to belong to job-6, got job-5`). 지연 없는 로컬 `npm test`는 순서가 우연히 유지돼 통과한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/store/report-temp-file-name.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: saveReport
---
# 보고서 임시 파일 이름을 시각만으로 만들면 동시 저장 때 겹친다

## 내용
- `saveReport`의 임시 파일 이름은 reportId와 시각(`stamp(now())`)을 함께 쓴다(src/store/report-archive.js). 시각만 쓰면 같은 밀리초의 동시 저장이 같은 임시 파일을 공유해 서로 덮어쓰고, rename이 ENOENT가 나거나 보관본이 다른 고객사 것이 된다.
- 같은 reportId를 같은 밀리초에 동시에 저장하면 여전히 겹칠 수 있다. 지금 호출 경로에는 없다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/testing/flaky-test-policy.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 간헐 실패하는 시험은 재시도, skip, 시간 제한 증가로 풀지 않는다

## 규칙
- 시험에 재시도를 붙이거나 skip하거나 시간 제한을 늘리는 것은 간헐 실패의 해결이 아니다. 시험이 아니라 원인이 되는 코드를 고친다.
- 시험 기대값을 바꿔 실패를 가리지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
