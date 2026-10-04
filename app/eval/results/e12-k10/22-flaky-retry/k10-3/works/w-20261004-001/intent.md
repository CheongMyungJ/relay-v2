---
schema_version: 1
version: 1
type: bugfix
---
## 목표
CI의 `npm run test:ci`에서 `ci/batch.test.js`가 간헐적으로 실패하는 문제(`expected report-6 to belong to job-6, got job-5`)의 근본 원인을 찾아 고친다. 실패는 지연이 실제와 비슷할 때만 드러나고, 로컬 `npm test`는 늘 통과한다.

## 비목표
- 시험에 재시도를 붙이거나, skip하거나, 시간 제한을 늘려 실패를 가리지 않는다.
- 이번 실패와 무관한 기능 변경이나 리팩터링은 하지 않는다.

## 원하는 결과
밤 배치가 지연이 있어도 각 report가 항상 자기 job에 대응한다(report-N은 job-N). `ci/batch.test.js`가 재실행 없이 안정적으로 통과한다.

## 완료조건
- [ ] 재현 절차(`ci/batch.test.js`의 간헐적 실패)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm test`도 통과한다
- [ ] 시험 쪽에 재시도, skip, 시간 제한 증가를 넣지 않고 원인이 되는 코드(src)에서 고친다
- [ ] `ci/batch.test.js`를 여러 번 반복 실행해도 실패하지 않는다

## 제약
- 시험 파일 변경으로 해결하지 않는다(요청에서 명시).

## 추가 의견
- 없음
