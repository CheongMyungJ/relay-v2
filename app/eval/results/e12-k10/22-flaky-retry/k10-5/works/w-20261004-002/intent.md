---
schema_version: 1
version: 1
type: bugfix
---
## 목표
`npm run test:ci`에서 ci/archive.test.js(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 시험)가 가끔 실패하는 문제를 없앤다.

## 비목표
- ci/batch.test.js의 간헐 실패는 따로 고쳐서 리뷰 중이므로 이번 범위가 아니다.

## 원하는 결과
ci/archive.test.js가 몇 번을 반복해 돌려도 안정적으로 통과한다. 실패 때 나던 `ENOENT: 파일이 없습니다: reports/2026-09/.<이름>.tmp`와 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`이 더 나오지 않는다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm run test:ci`를 여러 번 반복 실행해도 ci/archive.test.js가 매번 통과한다
- [ ] 시험 코드에 재시도, skip, 시간 제한 증가를 넣지 않고 제품 코드(src/)에서 고친다

## 제약
- (팀 지식 docs/knowledge/testing/flaky-test-policy.md) 시험에 재시도를 붙이거나, skip하거나, 시간 제한을 늘리는 것은 간헐 실패의 해결이 아니다. 제품 코드의 근본 원인을 고친다.

## 추가 의견
- 재현 방법: 로컬 `npm test`는 늘 통과하고 CI 전용 시험(`ci/`)에서만, 재실행하면 통과하는 식으로 가끔 실패한다.
