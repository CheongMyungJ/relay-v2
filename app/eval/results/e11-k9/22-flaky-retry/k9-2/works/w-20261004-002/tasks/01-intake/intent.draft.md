## 목표
`npm run test:ci`에서 ci/archive.test.js가 간헐적으로 실패하는 문제의 원인을 코드에서 제거한다.

## 비목표
- ci/batch.test.js의 간헐 실패는 따로 고쳐 리뷰 중이므로 이번 범위가 아니다.
- 시험 자체를 바꿔 실패를 가리는 것(재시도, skip, 시간 제한 증가, 지연 설정 축소)은 하지 않는다.

## 원하는 결과
밤 배치 뒤 보고서 보관 시험(ci/archive.test.js)이 `npm run test:ci`를 반복 실행해도 안정적으로 통과한다. 보관본의 고객사 내용이 섞이거나 임시 파일 ENOENT가 나지 않는다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (`npm run test:ci`의 ci/archive.test.js가 `ENOENT ... .tmp`, `보관본의 고객사가 다르다`로 실패하지 않는다)
- [ ] `npm test`와 `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm run test:ci`를 반복 실행(예: 20회)해도 ci/archive.test.js가 한 번도 실패하지 않는다
- [ ] 시험 파일에 재시도, skip, 시간 제한 증가, LATENCY 축소가 추가되지 않았다

## 제약
- (팀 지식 docs/knowledge/testing/flaky-tests-need-root-cause.md) 간헐 실패는 원인을 찾아 코드에서 제거한다. 재시도, skip, 시간 제한 증가, 지연 설정(LATENCY) 축소는 해결로 인정하지 않는다. `npm test`가 통과해도 `test:ci`를 반복 실행해 확인한다.

## 추가 의견
- 실패 로그는 실행마다 다르며 재실행하면 통과한다. 로컬 `npm test`는 늘 통과한다.
