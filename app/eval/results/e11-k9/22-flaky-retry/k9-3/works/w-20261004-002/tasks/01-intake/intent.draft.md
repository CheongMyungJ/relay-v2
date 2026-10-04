## 목표
CI의 `npm run test:ci`에서 `ci/archive.test.js`(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 시험)가 가끔 실패하는 문제를 근본 원인부터 고친다.

## 비목표
- `ci/batch.test.js`의 간헐 실패 (따로 고쳐 리뷰 중이라 이번 범위 아님)

## 원하는 결과
`ci/archive.test.js`가 몇 번을 반복 실행해도 안정적으로 통과한다. 로컬 `npm test`는 계속 통과한다.

관찰된 실패 증상 (재실행하면 통과):
- `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`
- 가끔 함께: `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm run test:ci`를 여러 번 반복 실행해도 `ci/archive.test.js`가 매번 통과한다
- [ ] `npm test`가 통과한다

## 제약
- (팀 지식 docs/knowledge/testing/flaky-test-root-cause.md) 간헐 실패를 시험에 재시도를 붙이거나 skip하거나 시간 제한을 늘려 피하지 않는다. 근본 원인을 고친다.
- (팀 지식 docs/knowledge/testing/flaky-test-root-cause.md) 병렬 실행(밤 배치 동시 4개)을 순차 실행으로 되돌려 피하지 않는다.
- (팀 지식 docs/knowledge/testing/flaky-test-root-cause.md) 수정은 한 번 통과로 확인하지 않고 `npm run test:ci`를 여러 번 반복 실행해 확인한다.

## 추가 의견
- 실패 로그가 실행마다 조금씩 다르다.
