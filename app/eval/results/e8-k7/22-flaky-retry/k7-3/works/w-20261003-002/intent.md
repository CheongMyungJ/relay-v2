---
schema_version: 1
version: 1
type: bugfix
---
## 목표
`npm run test:ci`에서 `ci/archive.test.js`가 간헐적으로 실패하는 문제를 없앤다. 밤 배치 뒤 보고서가 보관소에 정확히 남아야 하고, 동시 실행에서도 항상 그래야 한다.

## 비목표
- `ci/batch.test.js`의 간헐 실패 (따로 고쳐서 리뷰 중)
- 동시성(4개)을 낮추거나 순차로 되돌리는 것

## 원하는 결과
`ci/archive.test.js`가 반복 실행해도 `ENOENT: 파일이 없습니다: reports/2026-09/*.tmp`나 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)` 없이 늘 통과한다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (`ci/archive.test.js`를 여러 번 반복 실행해도 통과한다)
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm test`가 계속 통과한다
- [ ] 시험에 재시도, skip, 시간 제한 증가를 넣지 않고 `src/`의 원인을 고친다

## 제약
- (팀 지식 docs/knowledge/keep-parallel-concurrency.md) 간헐 실패가 동시성에서 드러나도 동시성(4개)을 낮추거나 순차로 되돌려 가리지 않는다. 동시 실행에서도 맞게 동작하도록 코드를 고친다.
- (팀 지식 docs/knowledge/no-retry-skip-for-flaky-tests.md) 간헐 실패 시험은 재시도, skip, 시간 제한 증가로 풀지 않고 지연(타이밍)에 따라 드러나는 원인을 src/에서 찾아 고친다.

## 추가 의견
- 로컬 `npm test`는 늘 통과하고 CI 전용 시험에서만 가끔 실패하며, 재실행하면 통과한다.
