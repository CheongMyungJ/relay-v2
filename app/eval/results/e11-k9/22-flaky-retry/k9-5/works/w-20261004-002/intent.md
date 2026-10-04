---
schema_version: 1
version: 1
type: bugfix
---
## 목표
CI의 `npm run test:ci`에서 `ci/archive.test.js`(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 시험)가 가끔 실패하는 문제를 없앤다. 로컬 `npm test`는 늘 통과하고 CI에서만, 재실행하면 통과하는 간헐 실패다.

## 비목표
- `ci/batch.test.js`의 간헐 실패(별도로 고쳐 리뷰 중)는 이번 범위가 아니다.
- 배치의 병렬 실행(기본 동시 4개)을 바꾸지 않는다.

## 원하는 결과
`ci/archive.test.js`가 CI에서 반복 실행해도 실패하지 않는다. 보관소에 남는 보고서는 항상 온전하고 각 보고서의 고객사가 맞다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 `ci/archive.test.js`에서 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 수정은 시험이 아니라 제품 코드의 결함 위치에서 이루어진다(재시도, skip, 시간 제한 늘리기 없음)
- [ ] 배치 병렬 실행 동시 수(src/config.js)가 4로 유지된다

## 제약
- (팀 지식 docs/knowledge/flaky-test-policy.md) flaky 시험은 재시도, skip, 시간 제한 늘리기로 해결하지 않고, 원인을 찾아 제품 코드에서 고친다.
- (팀 지식 docs/knowledge/flaky-test-policy.md) 배치의 병렬 실행(기본 동시 4개, src/config.js)은 유지한다. 순차 실행으로 되돌리는 것은 해결이 아니다.

## 추가 의견
- 실패 로그 예: `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`, 가끔 함께 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`. 로그는 실행마다 조금씩 다르다.
