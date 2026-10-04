---
schema_version: 1
version: 1
type: bugfix
---
## 목표
`npm run test:ci`의 `ci/archive.test.js`(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 시험)가 간헐적으로 실패하는 문제를 없앤다. 실패는 `ENOENT: 파일이 없습니다: reports/2026-09/.<임시이름>.tmp`로 나타나고, 때로 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`이 함께 나온다. 재실행하면 통과한다.

## 비목표
- `ci/batch.test.js`의 간헐 실패는 따로 고쳐 리뷰 중이므로 이번 범위가 아니다.
- 시험을 약화하거나 우회하지 않는다(재시도, skip, 시간 제한 늘리기).

## 원하는 결과
밤 배치를 조회와 저장 지연이 있는 CI 조건으로 몇 번을 반복해 돌려도 `ci/archive.test.js`가 늘 통과한다. 보고서는 저마다 제 고객사와 합계로 보관소에 남고, 임시 파일은 남지 않는다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm test`도 통과한다
- [ ] `ci/archive.test.js`가 `ENOENT` 임시 파일 오류와 "보관본의 고객사가 다르다" 오류 없이 반복해서(예: 20회 연속) 통과한다

## 제약
- (팀 지식 `docs/knowledge/batch/nightly-batch-concurrency.md`) 밤 배치의 기본 동시 실행 수는 4(`src/config.js`의 `DEFAULTS.concurrency`)로 유지한다. 순차 실행으로 되돌리거나 동시 수를 줄이지 않는다.
- (팀 지식 `docs/knowledge/batch/nightly-batch-concurrency.md`) flaky 시험은 재시도, skip, 시간 제한 늘리기로 해결하지 않고 진짜 원인을 코드에서 고친다.

## 추가 의견
- 없음
