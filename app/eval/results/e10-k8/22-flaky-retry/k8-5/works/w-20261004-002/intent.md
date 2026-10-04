---
schema_version: 1
version: 1
type: bugfix
---
## 목표
CI 전용 시험 `ci/archive.test.js`(밤 배치 뒤 보고서가 보관소에 제대로 남는지 확인)가 `npm run test:ci`에서 가끔 실패하는 원인을 찾아 `src/`에서 고친다.

## 비목표
- `ci/batch.test.js`의 간헐 실패는 따로 고쳐 리뷰 중이므로 이번 범위가 아니다.
- 시험 코드, 시험의 기대값, 조회 지연 값(`LATENCY`)을 바꾸지 않는다.

## 원하는 결과
`npm run test:ci`를 반복 실행해도 `ci/archive.test.js`가 실패하지 않는다. 실패할 때 보이던 증상은 두 가지다.
- `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp` (실행마다 파일 이름은 다름)
- 가끔 함께 나오는 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`

로컬 `npm test`는 늘 통과한다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`, 특히 `node --test ci/archive.test.js` 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `node --test ci/archive.test.js`를 20회 연속 실행해 모두 통과한다
- [ ] 병렬 실행(동시 4개, `concurrency: 4`)이 그대로 유지된다
- [ ] 변경이 `ci/batch.test.js`가 다루는 동작에 닿지 않는다

## 제약
- (팀 지식 `docs/knowledge/testing/flaky-tests-fix-the-cause.md`) 간헐 실패는 재시도, skip, 시간 제한 증가, 순차 실행으로 덮지 않고 원인을 고친다. 병렬 실행(동시 4개, `concurrency: 4`)은 유지한다. 조회 지연 값(`LATENCY`)이나 시험의 기대값을 바꿔 증상을 가리지 않고 `src/`의 원인 코드를 고친다.

## 추가 의견
- 없음
