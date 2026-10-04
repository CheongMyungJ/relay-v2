## 목표
`npm run test:ci`에서 `ci/archive.test.js`(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 CI 전용 시험)가 간헐적으로 실패하는 문제를 고친다.

## 비목표
- `ci/batch.test.js`의 간헐 실패는 따로 고쳐서 리뷰 중이므로 이번 범위가 아니다.
- 새 기능 추가나 구조 개편은 하지 않는다.

## 원하는 결과
`ci/archive.test.js`가 반복 실행해도 항상 통과한다. 현재 실패 로그는 실행마다 조금씩 다르다.
- `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`
- 가끔 함께: `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`

재실행하면 통과하고, 로컬 `npm test`는 늘 통과한다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`, 특히 `ci/archive.test.js` 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm test`와 `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `node --test ci/archive.test.js`를 여러 번 반복 실행해도 한 번도 실패하지 않는다
- [ ] 수정이 `ci/archive.test.js`가 아니라 원인이 되는 src 코드에 들어간다
- [ ] 배치 병렬 실행(동시 4개)은 그대로 유지되고, 순차 실행으로 되돌리지 않는다
- [ ] 수정 후 `npm run test:ci`와 `node --test ci/archive.test.js`를 여러 번 반복 실행한 결과(실행 횟수와 통과/실패 수)를 보고한다

## 제약
- (팀 지식 docs/knowledge/testing/flaky-test-policy.md) 간헐 실패 시험은 재시도, skip, 시간 제한 늘리기로 해결하지 않고, 근본 원인을 찾아 원인이 되는 코드(src)에서 고친다.

## 추가 의견
- 없음
