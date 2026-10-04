---
schema_version: 1
version: 1
type: bugfix
---
## 목표
CI 전용 시험 `ci/batch.test.js`(밤 배치를 실제와 비슷한 지연으로 실행)가 간헐적으로 실패하는 진짜 원인을 찾아 코드에서 고친다.

## 비목표
- 시험에 재시도를 붙이거나, skip하거나, 시간 제한을 늘리는 방식의 우회 (해결이 아님)
- 로컬 `npm test` 시험의 변경이나 무관한 기능 변경

## 원하는 결과
지연 타이밍과 관계없이 report가 항상 자기 job에 속한다. 즉 `expected report-N to belong to job-N, got job-(N-1)` 같은 불일치가 다시 나타나지 않는다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`를 반복 실행해도 `ci/batch.test.js`)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `ci/batch.test.js`에 재시도, skip, 시간 제한 증가가 추가되지 않는다
- [ ] 원인이 된 코드 경로를 고치고, 그 불일치를 잡는 시험이 있다

## 제약
- 간헐적 실패이므로 한 번 통과로 판단하지 않고 반복 실행으로 확인한다

## 추가 의견
- 실패 로그: `expected report-6 to belong to job-6, got job-5`. 재실행하면 통과한다.
