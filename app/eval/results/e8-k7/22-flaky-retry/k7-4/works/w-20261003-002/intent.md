---
schema_version: 1
version: 1
type: bugfix
---
## 목표
`npm run test:ci`에서 `ci/archive.test.js`가 가끔 실패하는 문제를 없앤다. 재실행하면 통과하는 간헐 실패이며, 밤 배치 뒤 보고서가 보관소에 제대로 남아야 한다.

## 비목표
- `ci/batch.test.js`의 간헐 실패 (따로 고쳐 리뷰 중)
- 동시 실행 수(concurrency) 변경
- 시험에 재시도, skip, 시간 제한 늘리기를 붙이는 것

## 원하는 결과
`ci/archive.test.js`를 반복 실행해도 실패하지 않는다. 보관된 보고서마다 해당 고객사의 내용이 남고, `reports/` 아래에 임시 파일이 남지 않는다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (`ci/archive.test.js`를 반복 실행해도 `ENOENT ... .tmp`와 `보관본의 고객사가 다르다` 오류가 나오지 않는다)
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 로컬 `npm test`도 계속 통과한다
- [ ] 이 간헐 실패를 결정적으로 재현하는 시험이 추가되어, 수정 전에는 실패하고 수정 후에는 통과한다

## 제약
- (팀 지식 `docs/knowledge/keep-parallel-concurrency-4.md`) 병렬 실행(동시 4개)은 유지한다. 경쟁이나 순서 문제는 동시성을 낮춰 피하지 말고 원인을 고친다.
- (팀 지식 `docs/knowledge/no-retry-skip-timeout-for-flaky.md`) 간헐 실패는 시험에 재시도를 붙이거나 skip하거나 시간 제한을 늘려 덮지 않는다. 시험의 검증 내용을 약화하는 것도 해결이 아니다. 타이밍에 의존하는 원인을 소스 코드에서 찾아 고친다.

## 추가 의견
- 실패 로그 예: `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`, `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`. 로컬 `npm test`는 늘 통과한다.
