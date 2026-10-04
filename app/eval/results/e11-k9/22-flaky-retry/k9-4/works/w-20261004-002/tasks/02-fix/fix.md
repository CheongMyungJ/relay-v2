## 재현
- 재현 절차: `npm run test:ci`를 반복 실행 (`for i in $(seq 1 8); do npm run test:ci; done`)
- 결과: 재현됨
- 기대: `ci/archive.test.js` 두 시험 모두 통과
- 실제: 8번 중 4번 실패. "보고서가 모두 보관소에 저장된다"(ENOENT 임시 파일)와 "보관본마다 제 고객사와 합계"가 함께 실패하기도 함

## 원인
- 원인: `saveReport`가 임시 파일 이름을 `.${stamp(now())}.tmp`, 곧 ms 시각만으로 만든다. 병렬 실행(동시 4개)에서 같은 ms에 저장하는 보고서들이 같은 임시 파일을 쓰고 rename해서, 다른 고객사 내용이 보관되거나 먼저 rename한 쪽 때문에 뒤쪽 rename이 ENOENT가 난다.
- 근거: `src/store/report-archive.js:23`. 로컬 `npm test`는 지연이 없어 같은 ms 충돌이 드물다. CI 시험은 저장 지연(`ci/archive.test.js`의 latency)이 있어 겹친다. 시각을 고정해 동시 저장하는 재현 테스트가 수정 전 실패, 수정 후 통과(아래).
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/store/report-archive.js — 임시 이름을 `.${reportId}.${stamp}.tmp`로 바꿔 보고서마다 다르게 했다. listReports/strayTemps의 필터(`.` 시작, `.tmp` 끝)는 그대로 맞는다.
- test/archive.test.js — 같은 시각 동시 저장 재현 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/archive.test.js "같은 시각에 동시에 저장해도 보고서마다 임시 파일이 달라 제 내용으로 남는다"
- 수정 전: 실패 (`node --test test/archive.test.js` → fail 1)
- 수정 후: 통과 (같은 명령 → pass 10, fail 0)

## 테스트 실행
- 명령: `npm run test:ci` 15회 반복, `npm test` 1회
- 결과: `npm test` 통과(63). `test:ci` 15회 중 13회 전부 통과, 2회 실패. `ci/archive.test.js`는 15회 모두 통과.
- 실패 항목: 2회 실패는 모두 `ci/batch.test.js`의 "밤 배치: 보고서마다 제 작업과 고객사가 붙는다" — 기준 커밋(수정 전 반복 실행 6번째)에서도 실패하던 항목이며, 비목표(따로 리뷰 중)다.
