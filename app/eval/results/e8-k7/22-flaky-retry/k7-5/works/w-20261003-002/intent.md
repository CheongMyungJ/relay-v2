---
schema_version: 1
version: 1
type: bugfix
---
## 목표
`npm run test:ci`에서 ci/archive.test.js가 간헐적으로 실패하는 문제를 근본 원인부터 고친다. 밤 배치 뒤 보고서가 보관소에 제대로 남아야 한다.

## 비목표
- ci/batch.test.js의 간헐 실패는 별도 Work에서 고쳐 리뷰 중이므로 다루지 않는다.
- 배치 병렬 실행(기본 동시 4개)을 줄이거나 순차로 되돌리지 않는다.

## 원하는 결과
ci/archive.test.js가 반복 실행해도 항상 통과한다. 보관본이 올바른 고객사의 것이고, 보관 중 임시 파일(`reports/2026-09/.*.tmp`)이 없어져 ENOENT가 나지 않는다.

## 완료조건
- [ ] 재현 절차(ci/archive.test.js 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다 (`npm test`도 통과한다)
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm run test:ci`를 20회 반복 실행해 모두 통과한다
- [ ] 시험 코드(test/, ci/)에서 재시도, skip, timeout 증가, 지연 값·검증 완화를 쓰지 않는다

## 제약
- (팀 지식 docs/knowledge/no-flaky-workarounds.md) 간헐 실패를 재시도, skip, timeout 증가, 지연 값이나 검증 완화로 넘기지 않고 src/ 코드의 원인을 찾아 고친다.
- (팀 지식 docs/knowledge/keep-batch-parallelism.md) src/runner/의 병렬 실행(기본 동시 4개)을 유지한 채 근본 원인을 고친다.

## 추가 의견
- 실패 로그는 매번 조금씩 다르다. 주로 `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`, 가끔 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`이 함께 나온다.
- 로컬 `npm test`는 늘 통과하고 CI에서만, 재실행하면 통과하는 간헐 실패다.
