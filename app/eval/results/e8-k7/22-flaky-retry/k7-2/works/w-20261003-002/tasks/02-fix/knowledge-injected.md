## docs/knowledge/archive-tmp-name-needs-unique-part.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 보관 임시 파일 이름에 ms 시각만 쓰면 동시 저장에서 겹친다

- 종류: 실패 유형
- 적용: src/store/report-archive.js (saveReport)
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

`.${stamp(now())}.tmp`처럼 ms 시각만으로 만든 임시 파일 이름은 같은 ms에 동시 저장하는 두 작업이 같은 파일을 써서,
뒤 작업의 rename이 `ENOENT`로 실패한다(ci/archive.test.js가 간헐 실패). 이름에 reportId 같은 고유 요소를 넣는다.
같은 reportId를 동시에 저장하는 경우까지는 막지 않는다. 임시 파일 이름 규칙에 의존하는 쪽(정산팀)이 있으면 확인한다.

## docs/knowledge/batch-keeps-parallel-concurrency-4.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 배치는 병렬(동시 4개)로 실행한다. 순차 실행으로 되돌리는 것은 해결이 아니다

- 종류: 규칙
- 적용: src/runner/pool.js, src/runner/runner.js, src/config.js (concurrency 기본 4)
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

배치 결과가 어긋나거나 시험이 흔들릴 때 concurrency를 1로 낮추는 식의 순차 실행 복귀는 해결로 인정하지 않는다.
병렬(동시 4개)을 유지한 채 원인을 고친다. 예: runPool은 결과를 끝난 순서가 아니라 items의 인덱스 자리에 넣는다.

## docs/knowledge/no-retry-skip-timeout-for-flaky-tests.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 간헐 실패 시험은 재시도·skip·시간 제한 증가가 아니라 원인을 고친다

- 종류: 규칙
- 적용: ci/, test/, 간헐 실패(flaky) 대응 전반
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

간헐 실패하는 시험에 재시도를 붙이거나, skip하거나, timeout을 늘리는 것은 해결로 인정하지 않는다.
시험의 검증을 약화하는 것도 마찬가지다. 원인을 찾아 제품 코드(또는 시험의 잘못된 가정)를 고친다.
예: `expected report-6 to belong to job-6, got job-5`는 시간 문제가 아니라 결과 순서 문제였다 (src/runner/pool.js).
로컬 `npm test`는 ci/를 포함하지 않아 늘 통과하므로, 재현은 `npm run test:ci`를 여러 번(예: 20회) 반복한다.

## docs/knowledge/runpool-results-in-items-order.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# runPool 결과는 items 순서여야 한다

- 종류: 실패 유형
- 적용: src/runner/pool.js, src/collect/collector.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

collectResults가 결과를 인덱스로 작업과 짝짓는다. runPool이 결과를 끝난 순서로 push하면 지연 순서에 따라
report가 다른 job에 붙는다(report-2가 job-1 소속으로 보임). 지연이 없는 로컬 환경에서는 드러나지 않는다.
결과는 `results[start + i]`처럼 items 인덱스 자리에 넣는다. 병렬 실행 자체는 바꾸지 않는다.
