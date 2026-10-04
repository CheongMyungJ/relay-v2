## docs/knowledge/ci-tests-expose-ordering-races.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# ci/ 시험은 지연 jitter로 완료 순서가 바뀔 때만 실패한다

- 종류: 실패 유형
- 적용: ci/batch.test.js, ci/archive.test.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

로컬 npm test는 지연이 없어 완료 순서가 입력 순서와 같아 늘 통과한다. 순서나 동시 시작 시각에 의존하는 버그는 npm run test:ci에서만 가끔 드러난다.
비슷한 사례: saveReport 임시 파일 이름이 같은 ms에 겹쳐 ci/archive.test.js가 간헐 실패했다(이름에 reportId를 넣어 고침).
확인은 ci 시험을 20회 이상 반복 실행한다.

## docs/knowledge/keep-batch-parallelism.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 배치의 병렬 실행(동시 4개)은 flaky 해결을 위해 줄이거나 순차로 되돌리지 않는다

- 종류: 규칙
- 적용: src/runner/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

순차 실행으로 되돌리거나 동시 실행 수를 줄이는 것은 해결이 아니다. 병렬(기본 동시 4개)을 유지한 채 근본 원인을 고친다.
까닭: 순서 의존 버그는 병렬을 없애면 가려질 뿐 남아 있다.

## docs/knowledge/no-flaky-workarounds.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# flaky 시험은 재시도, skip, 시간 제한 증가가 아니라 근본 원인을 고친다

- 종류: 규칙
- 적용: test/, ci/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

간헐 실패(재실행하면 통과)를 재시도, skip, timeout 증가, 지연 값이나 검증 완화로 넘기지 않는다.
src/ 코드의 원인을 찾아 고친다. 예: 'expected report-6 to belong to job-6, got job-5'는 시험이 아니라 runPool 순서 버그였다.

## docs/knowledge/runpool-preserve-input-order.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# runPool 결과는 입력 순서여야 한다

- 종류: 규칙
- 적용: src/runner/pool.js, src/collect/collector.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

collectResults는 outcomes[i]가 jobs[i]의 결과라고 인덱스로 짝짓는다. 그래서 runPool은 완료 순서가 아니라 items 순서로 결과를 돌려줘야 한다.
틀린 예: 완료 순서로 results.push → 조회 지연 jitter로 같은 묶음 안 순서가 바뀌면 report-6이 job-5 기록에 붙는다.
맞는 예: results[start + i]에 넣는다. 회귀 시험: test/pool.test.js.
