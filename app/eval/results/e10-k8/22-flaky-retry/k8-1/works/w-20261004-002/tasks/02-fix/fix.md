## 재현
- 재현 절차: `npm run test:ci`를 반복 실행 (`for i in 1 2 3 4 5 6; do npm run test:ci; done`)
- 결과: 재현됨
- 기대: `ci/archive.test.js` 통과
- 실제: 6번 중 4번 실패. `ENOENT: 파일이 없습니다: reports/2026-09/.<꼬리표>.tmp`, 같이 `report-6 보관본의 고객사가 다르다: hooli (stark여야 함)`. 같은 임시 파일 이름으로 두 작업(job-3, job-2)이 함께 ENOENT가 난 로그도 있었다.

## 원인
- 원인: `saveReport`가 임시 파일 이름을 `.${stamp(now())}.tmp`로 만들어 이름이 밀리초 시각에만 달려 있다. 배치가 작업을 동시에 돌리므로 같은 밀리초에 시작한 두 저장이 같은 임시 파일을 쓴다. 먼저 끝난 쪽이 rename으로 임시 파일을 옮겨 가면 다른 쪽 rename은 ENOENT가 나고, 임시 파일에 남은 내용이 다른 고객사 것이면 다른 보고서 이름으로 옮겨져 고객사가 뒤바뀐다.
- 근거: `src/store/report-archive.js:24` 임시 이름이 시각만으로 정해짐. 실패 로그의 ENOENT 경로가 두 작업에서 동일(`.mutcbmsv.tmp`). 로컬 `npm test`는 지연이 없어 저장이 겹치지 않아 통과. 실험: 이름에 호출마다 늘어나는 번호를 붙이자 `ci/archive.test.js` 실패가 15회 반복에서 0건이 됐다.
- 사람 추정 판정: "실패 로그는 매번 다르다"는 관찰 — 맞음. 임시 이름(시각 꼬리표)이 매번 다르고, ENOENT와 고객사 불일치는 같은 충돌의 두 모습이다.
- 기각한 가설: 보관소의 쓰는 도중 앞부분만 보이는 동작이 원인 — 기각. rename이 한 번에 일어나고 읽는 시험은 `before` 뒤에 돈다. 시험 지연/timeout 문제 — 기각(덮는 방식은 제약상 금지이고 충돌은 지연과 무관하게 같은 ms면 생김).

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름에 호출마다 늘어나는 번호를 덧붙여 `.<시각>-<번호>.tmp`로 해 충돌을 없앴다 (`listReports`/`strayTemps` 필터는 그대로 통한다).
- test/archive.test.js — 재현 시험 추가 (기존 시험은 바꾸지 않음).

## 재현 테스트
- 위치: test/archive.test.js `보고서 보관: 같은 시각에 동시에 저장해도 임시 파일이 겹치지 않는다`
- 수정 전: 실패 (`npm test` → `not ok 10`, pass 62 / fail 1)
- 수정 후: 통과 (`npm test` → pass 63 / fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` (15회 반복 2번)
- 결과: `npm test` 통과. `ci/archive.test.js`는 반복 30회 모두 통과. `npm run test:ci` 전체는 일부 반복에서 실패.
- 실패 항목: `ci/batch.test.js`의 `밤 배치: 보고서마다 제 작업과 고객사가 붙는다` (`expected report-N to belong to job-N`) — 이번 범위 밖. 이 항목은 이번 수정과 무관한 별도 원인(앞 Work w-20261004-001에서 고치는 중, runPool 결과 순서)이다. 기준 커밋에서도 실패(처음 반복 실행에서 같은 실패를 봄).
