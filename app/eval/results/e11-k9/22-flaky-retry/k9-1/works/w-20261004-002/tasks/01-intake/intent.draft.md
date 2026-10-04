## 목표
`npm run test:ci`에서 `ci/archive.test.js`(밤 배치 뒤 보고서가 보관소에 남는지 보는 시험)가 가끔 실패하는 문제를 없앤다.

## 비목표
- `ci/batch.test.js`의 간헐 실패는 따로 고쳐서 리뷰 중이므로 이번 범위가 아니다.

## 원하는 결과
지연이 있는 CI 환경에서도 `ci/archive.test.js`가 재실행 없이 늘 통과한다. 보관소에는 보고서가 임시 파일 흔적 없이, 각 보고서의 올바른 내용(고객사 등)으로 남는다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm test`와 `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `ci/archive.test.js`를 `npm run test:ci`로 여러 번 반복 실행해도 한 번도 실패하지 않는다
- [ ] 시험에 재시도, skip, 시간 제한 증가를 추가하지 않는다

## 제약
- (팀 지식 docs/knowledge/testing/flaky-test-policy.md) 간헐 실패하는 시험에 재시도, skip, 시간 제한 증가를 붙이지 않는다. 원인은 시험이 아니라 제품 코드에서 찾아 고친다.
- (팀 지식 docs/knowledge/testing/flaky-test-policy.md) 로컬 `npm test`는 지연이 0이라 가리므로, 지연이 있는 `ci/` 시험(`npm run test:ci`)으로 확인한다.

## 추가 의견
- 보고된 증상: `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`, 가끔 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`이 함께 나옴. 로컬 `npm test`는 늘 통과, 재실행하면 통과.
