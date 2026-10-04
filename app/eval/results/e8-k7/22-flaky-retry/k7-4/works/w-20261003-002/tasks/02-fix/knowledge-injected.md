## docs/knowledge/keep-parallel-concurrency-4.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 병렬 실행(동시 4개)은 유지한다. 순차로 되돌려 해결하지 않는다

- 종류: 규칙
- 적용: src/config.js (concurrency 기본 4), src/runner/pool.js
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

경쟁이나 순서 문제는 동시성을 낮춰 피하지 말고 원인(순서 가정, 공유 자원)을 고친다.

## docs/knowledge/no-retry-skip-timeout-for-flaky.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 간헐 실패는 재시도·skip·시간 제한 늘리기로 해결하지 않는다

- 종류: 규칙
- 적용: ci/, test/ 전반
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

간헐 실패(재실행하면 통과)는 시험에 재시도를 붙이거나, skip하거나, 시간 제한을 늘려 덮지 않는다.
타이밍에 의존하는 원인을 소스 코드에서 찾아 고친다.
시험의 검증 내용을 약화하는 것도 해결이 아니다.

## docs/knowledge/pool-results-in-items-order.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# runPool 결과는 완료 순서가 아니라 items 순서여야 한다

- 종류: 실패 유형
- 적용: 관련 위치 src/runner/pool.js, src/collect/collector.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

collectResults는 outcomes[i]와 jobs[i]를 짝짓는다고 가정한다. 끝나는 순서대로 push하면 지연이 다를 때 report-N이 다른 job에 붙는다.
증상: `expected report-6 to belong to job-6, got job-5` (ci/batch.test.js, 조회 지연 지터 때문에 가끔만).
test/는 지연이 없어 못 잡는다. 결정적 시험은 지연을 [30,1,15,5]처럼 고정한다.

## docs/knowledge/report-temp-file-name-must-be-unique.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 보고서 임시 파일 이름은 작업마다 달라야 한다 (시각만으로는 겹친다)

- 종류: 실패 유형
- 적용: 관련 위치 src/store/report-archive.js (saveReport), src/util/ids.js (stamp)
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

같은 폴더에 동시(4개) 저장하면 같은 ms에 시작한 저장들이 시각 꼬리표만 쓴 임시 이름을 공유해 서로의 내용을 덮어쓴다.
증상: ci/archive.test.js에서 보관본의 고객사가 다름(expected 'stark', actual 'wayne'), 임시 파일 잔존. test/는 시계를 가짜로 써 못 잡는다.
임시 이름에는 reportId처럼 작업마다 다른 값을 넣는다. 결정적 시험은 sleep을 멈춰 같은 시각을 만든다.
