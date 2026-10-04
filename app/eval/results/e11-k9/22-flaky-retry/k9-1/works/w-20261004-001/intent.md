---
schema_version: 1
version: 1
type: bugfix
---
## 목표
CI의 `npm run test:ci`에서 `ci/batch.test.js`가 간헐적으로 `expected report-6 to belong to job-6, got job-5`로 실패하는 문제의 원인을 찾아 코드에서 고친다.

## 비목표
- 시험에 재시도를 붙이거나, skip하거나, 시간 제한을 늘리는 것은 해결로 치지 않는다. 하지 않는다.
- 밤 배치의 기능 추가나 구조 변경은 하지 않는다.

## 원하는 결과
밤 배치가 실제와 비슷한 지연 아래에서도 각 report가 항상 자기 job에 속한다. `ci/batch.test.js`가 반복 실행해도 안정적으로 통과한다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다
- [ ] `npm test`와 `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `ci/batch.test.js`를 연속 여러 번(예: 20회) 실행해도 매번 통과한다
- [ ] `ci/batch.test.js`에 재시도, skip, 시간 제한 증가가 추가되지 않았다

## 제약
- 원인은 시험이 아니라 제품 코드에서 찾아 고친다(요청의 "해결이 아니다" 조건).

## 추가 의견
- 로컬 `npm test`는 늘 통과하고 CI 전용 시험만 간헐 실패한다. 지연 타이밍과 관련 있을 수 있으나 확인되지 않았다.
