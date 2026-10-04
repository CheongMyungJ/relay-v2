## docs/knowledge/runner/runpool-result-order.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: investigation
anchor: runPool
---
# runPool 결과는 입력 순서여야 한다

## 규칙
- `runPool`(src/runner/pool.js)은 완료 순서가 아니라 items와 같은 순서로 결과를 돌려준다. `collectResults`(src/collect/collector.js)가 `outcomes[i]`를 `jobs[i]`와 인덱스로 짝짓기 때문이다.
- 진행 알림(`onChunk`)의 `done`은 결과 배열 길이가 아니라 별도 카운터로 센다.

## 바뀐 이력
- 2026-10-04 처음 남김: 완료 순서로 push하던 것을 입력 순서 자리에 넣게 고침 (Work w-20261004-001)

## docs/knowledge/store/report-temp-file-name.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: saveReport
---
# 보고서 임시 파일 이름이 겹치면 다른 고객사 내용이 저장된다

## 내용
- `saveReport`(src/store/report-archive.js)는 임시 파일에 쓰고 rename한다. 임시 이름이 시각(ms)만이면 같은 ms에 저장하는 보고서끼리 겹쳐 한 보고서가 다른 고객사의 내용으로 덮이거나 rename ENOENT로 실패한다. 지연이 있는 ci/archive.test.js에서 약 절반 실행에 실패했다.
- 임시 이름에는 reportId를 넣어 보고서마다 다르게 한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/testing/flaky-tests-need-root-cause.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 간헐 실패는 재시도, skip, 시간 제한 증가, 지연 설정 축소로 해결하지 않는다

## 규칙
- 간헐적으로 실패하는 시험은 원인을 찾아 코드에서 제거한다. 시험에 재시도를 붙이거나 skip하거나 시간 제한을 늘리거나 지연 설정(LATENCY)을 줄이는 것은 해결로 인정하지 않는다.
- 지연이 있는 시험(`ci/`, `npm run test:ci`)에서만 드러나는 순서·경합 문제가 있다. `npm test`가 통과해도 `test:ci`를 반복 실행해 확인한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
