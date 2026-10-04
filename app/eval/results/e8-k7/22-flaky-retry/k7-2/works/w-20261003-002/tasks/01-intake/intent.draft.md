## 목표
CI의 `npm run test:ci`에서 ci/archive.test.js(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 시험)가 간헐적으로 실패하는 원인을 찾아 고친다.

## 비목표
- ci/batch.test.js의 간헐 실패 (별도 Work에서 리뷰 중)
- 배치 실행 방식(병렬 동시 4개)을 바꾸는 것

## 원하는 결과
ci/archive.test.js가 반복 실행해도 안정적으로 통과한다. 보관소에는 각 보고서가 올바른 고객사 내용으로 남고, 아래 두 실패가 더 나오지 않는다.
- `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp` (주로 나타남)
- `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)` (가끔 함께 나타남)

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (`npm run test:ci`를 20회 반복해 ci/archive.test.js가 한 번도 실패하지 않는다)
- [ ] `npm test`와 `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] ci/archive.test.js의 검증 내용(보관본의 존재와 고객사 일치)이 그대로 유지된다
- [ ] 배치 동시 실행 수(기본 4)가 그대로다

## 제약
- (팀 지식 docs/knowledge/no-retry-skip-timeout-for-flaky-tests.md) 간헐 실패 시험은 재시도, skip, timeout 증가로 해결하지 않고 원인을 고친다. 시험 검증을 약화하는 것도 해결이 아니다.
- (팀 지식 docs/knowledge/batch-keeps-parallel-concurrency-4.md) concurrency를 1로 낮추는 순차 실행 복귀는 해결이 아니다. 병렬(동시 4개)을 유지한 채 고친다.
- 로컬 `npm test`는 ci/를 포함하지 않아 늘 통과한다. 재현은 `npm run test:ci` 반복으로 한다.

## 추가 의견
- 재실행하면 통과하는 간헐 실패다. 실패 로그는 그때그때 조금씩 다르다.
