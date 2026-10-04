## 목표
CI의 `npm run test:ci`에서 `ci/archive.test.js`(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 CI 전용 시험)가 간헐적으로 실패하는 문제를 코드의 원인을 찾아 고친다.

## 비목표
- `ci/batch.test.js`의 간헐 실패 (따로 고쳐 리뷰 중이라 이번 범위 아님)
- 시험 자체의 재시도, skip, 시간 제한 변경
- 밤 배치의 병렬 실행(기본 동시 4개) 변경

## 원하는 결과
`npm run test:ci`가 반복 실행해도 `ci/archive.test.js`에서 실패하지 않는다. 보관소에는 각 보고서가 제 고객사와 합계로 남고 임시 파일이 남지 않는다.

관찰된 증상(원인 아님):
- 보통 `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`
- 가끔 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`이 같이 나옴
- 재실행하면 통과, 로컬 `npm test`는 늘 통과

## 완료조건
- [ ] 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm run test:ci` 전체를 여러 번 반복 실행해 모두 통과한 결과를 근거로 남긴다
- [ ] `npm test`가 계속 통과한다

## 제약
- (팀 지식 docs/knowledge/ci/flaky-test-policy.md) 시험에 재시도를 붙이거나 skip하거나 시간 제한을 늘리는 것은 해결이 아니다.
- (팀 지식 docs/knowledge/ci/flaky-test-policy.md) 밤 배치의 병렬 실행(기본 동시 4개)은 유지하고, 순차 실행으로 되돌리지 않는다.
- (팀 지식 docs/knowledge/ci/flaky-test-policy.md) 고쳤다는 근거는 `test:ci` 전체 반복 실행 결과로 남긴다. 한 파일만 반복하지 않는다.

## 추가 의견
- 사람이 짚은 의심 위치는 없다.
