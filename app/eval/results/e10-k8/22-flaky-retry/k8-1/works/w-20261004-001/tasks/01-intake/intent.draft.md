## 목표
CI 전용 시험 `ci/batch.test.js`가 가끔 `expected report-6 to belong to job-6, got job-5`로 실패하는 간헐 실패의 원인을 찾아 코드에서 제대로 고친다.

## 비목표
- 시험에 재시도를 붙이거나 시험을 skip하는 것
- 시간 제한(timeout)을 늘리는 것
- 시험 기대값을 느슨하게 바꿔 실패를 가리는 것

## 원하는 결과
밤 배치를 실제와 비슷한 지연으로 돌려도 각 report가 항상 자기 job에 대응한다. 재실행 없이 `npm run test:ci`가 안정적으로 통과한다.

## 완료조건
- [ ] 재현 절차(`ci/batch.test.js`의 지연 조건)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `ci/batch.test.js`를 반복 실행(예: 20회 연속)해도 한 번도 실패하지 않는다
- [ ] `npm test`도 계속 통과한다
- [ ] 수정이 시험 코드의 재시도, skip, 시간 제한 증가에 기대지 않는다

## 제약
- 로컬 `npm test`는 늘 통과하고 CI 전용 시험(`ci/`)에서만 실패한다.

## 추가 의견
- 실패 로그: `expected report-6 to belong to job-6, got job-5` (재실행하면 통과)
