---
schema_version: 1
version: 1
type: bugfix
---
## 목표
CI 전용 시험 `ci/archive.test.js`(밤 배치 뒤 보고서가 보관소에 제대로 남는지 확인)가 `npm run test:ci`에서 간헐적으로 실패하는 문제를 없앤다. 원인을 코드에서 찾아 고친다.

## 비목표
- `ci/batch.test.js`의 간헐 실패는 따로 고쳐 리뷰 중이므로 이번 범위가 아니다.
- 시험을 재시도, skip, timeout 증가, 기대값 완화로 덮지 않는다.

## 원하는 결과
- `npm run test:ci`를 반복 실행해도 `ci/archive.test.js`가 실패하지 않는다.
- 보관소에 남은 보고서가 항상 올바른 작업·고객사의 것이고, 임시 파일(`.tmp`) 누락(ENOENT) 같은 오류가 나지 않는다.
- 원인을 결정적으로 막는 단위 시험이 추가된다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm test`와 `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 원인을 결정적으로 재현해 막는 단위 시험이 `test/` 아래에 추가되고, 수정 전 코드에서는 실패한다
- [ ] `ci/archive.test.js`의 재시도, skip, timeout, 기대값을 완화하지 않는다

## 제약
- (팀 지식 docs/knowledge/testing/flaky-tests-fix-cause.md) 간헐 실패 시험을 재시도, skip, 시간 제한(timeout) 증가, 기대값 완화로 덮지 않는다. 원인을 찾아 코드에서 고치고, 원인을 결정적으로 막는 단위 시험을 추가한다.

## 추가 의견
- 실패 로그는 매번 다르다. 보통 `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`이고, 가끔 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`이 같이 나온다. 재실행하면 통과하고, 로컬 `npm test`는 늘 통과한다.
