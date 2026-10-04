---
schema_version: 1
version: 1
type: bugfix
---
## 목표
CI의 `npm run test:ci`에서 ci/batch.test.js가 간헐적으로 `expected report-6 to belong to job-6, got job-5`로 실패한다. 밤 배치에서 보고서가 엉뚱한 작업에 붙는 원인을 찾아 근본적으로 고친다.

## 비목표
- 시험에 재시도를 붙이거나 skip하지 않는다.
- 시험의 시간 제한을 늘리지 않는다.
- 시험의 지연 설정(LATENCY)을 줄이거나 없애 실패를 가리지 않는다.

## 원하는 결과
조회 지연이 실제와 비슷하게 있어도 밤 배치의 모든 보고서가 항상 자기 작업(jobId)과 고객사에 맞게 붙는다. 실행 순서나 지연 편차에 따라 결과가 달라지지 않는다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (`npm run test:ci`의 ci/batch.test.js를 반복 실행해도 `expected report-N to belong to job-N` 실패가 없다)
- [ ] `npm test`가 통과한다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] ci/batch.test.js를 반복 실행(예: 20회 이상)해 모두 통과한다
- [ ] 보고서 결과가 작업과 어긋날 수 있던 원인이 코드에서 제거되며, 시험 쪽 우회로 가리지 않는다

## 제약
- 시험의 재시도, skip, 시간 제한 증가는 해결로 인정하지 않는다 (요청).

## 추가 의견
- 로컬 `npm test`는 늘 통과하고 CI 전용 시험(지연이 있는 시험)에서만 가끔 실패하며, 재실행하면 통과한다.
