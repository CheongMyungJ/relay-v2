## docs/knowledge/keep-parallel-concurrency.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 병렬 실행(동시 4개)을 줄이거나 순차로 되돌리는 것은 간헐 실패의 해결이 아니다

- 종류: 규칙
- 적용: src/runner/pool.js, src/nightly.js
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

간헐 실패가 동시성에서 드러나도 동시성(4개)을 낮추거나 순차로 되돌려 가리지 않는다. 동시 실행에서도 맞게 동작하도록 코드를 고친다.

## docs/knowledge/no-retry-skip-for-flaky-tests.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 간헐적으로 실패하는 시험은 재시도·skip·시간 제한 증가로 풀지 않고 코드에서 원인을 고친다

- 종류: 규칙
- 적용: ci/, test/ 전체
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

시험이 가끔 실패하면 재시도를 붙이거나, skip하거나, 시간 제한을 늘리는 것은 해결이 아니다. 지연(타이밍)에 따라 드러나는 원인을 src/에서 찾아 고친다.
예: `ci/batch.test.js`의 `expected report-6 to belong to job-6, got job-5`는 runPool이 완료 순서로 결과를 모아서 생긴 버그였다.

## docs/knowledge/pool-results-keep-input-order.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# runPool 결과는 입력 순서와 같아야 하고, 보고서 임시 파일 이름은 reportId를 포함해야 한다

- 종류: 실패 유형
- 적용: 관련 위치 src/runner/pool.js, src/collect/collector.js, src/store/report-archive.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

- collectResults는 index로 job과 결과를 짝짓는다. runPool이 완료 순서로 결과를 모으면 지연이 다를 때 report-6이 job-5에 붙는다. 로컬 `npm test`는 지연이 없어 통과하므로 `ci/`에서만 가끔 실패한다.
- saveReport 임시 파일 이름이 ms 시각뿐이면 같은 ms에 시작한 동시 저장이 같은 임시 파일을 써서 ENOENT나 내용 뒤바뀜이 난다. reportId를 이름에 넣는다.
