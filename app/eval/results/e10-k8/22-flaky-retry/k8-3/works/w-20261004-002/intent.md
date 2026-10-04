---
schema_version: 1
version: 1
type: bugfix
---
## 목표
`npm run test:ci`의 `ci/archive.test.js`(밤 배치 뒤 보고서 보관 확인)가 가끔 실패하는 문제를 제품 코드에서 고친다. 로컬 `npm test`는 늘 통과한다.

## 비목표
- `ci/batch.test.js`의 간헐 실패 (따로 고쳐 리뷰 중)
- 시험을 우회하는 것 (재시도, skip, 시간 제한 늘리기)
- 병렬 실행을 순차로 바꾸거나 동시성 수를 줄이는 것

## 원하는 결과
`ci/archive.test.js`가 반복 실행해도 실패하지 않는다. 보고서가 보관소에 모두 남고, 보관본마다 제 고객사와 합계가 맞고, 임시 파일이 남지 않는다. 병렬 실행은 그대로 유지한다.

관찰된 실패 증상:
- `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`
- 가끔 함께: `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`
- 재실행하면 통과한다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`의 `ci/archive.test.js`)가 더 이상 실패하지 않는다
- [ ] `npm test`와 `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `ci/archive.test.js`를 반복 실행한 결과(횟수와 통과 수)를 보고하고, 모두 통과한다 (예: 20회 중 20회)
- [ ] 병렬 실행(동시 4개)과 동시성 수가 그대로다

## 제약
- (팀 지식 docs/knowledge/testing/flaky-test-fix-policy.md) 시험에 재시도, skip, 시간 제한 늘리기를 넣는 것은 flaky 해결이 아니다. 제품 코드의 원인을 찾아 고친다.
- (팀 지식 docs/knowledge/testing/flaky-test-fix-policy.md) 병렬 실행을 순차로 되돌리거나 동시성 수를 줄이는 것은 해결이 아니다. 병렬은 유지한다.
- (팀 지식 docs/knowledge/testing/flaky-test-fix-policy.md) 고쳤다는 근거로 반복 실행 결과(횟수와 통과 수)를 보고한다.

## 추가 의견
- 없음
