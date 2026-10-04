## 재현
- 재현 절차: `npm run test:ci`를 6~15번 반복하거나 `node --test ci/archive.test.js`를 반복 실행
- 결과: 재현됨 (6번 중 2번 실패)
- 기대: 보고서가 모두 보관되고 임시 파일이 남지 않으며 고객사가 맞다
- 실제: `ENOENT: 파일이 없습니다: reports/2026-09/.muselkh4.tmp` (job-7 실패), `밤 배치: 보관본마다 제 고객사와 합계` 실패

## 원인
- 원인: `saveReport`가 임시 파일 이름을 시각 꼬리표(`.${stamp(now())}.tmp`)만으로 만들어, 같은 ms에 시작한 동시 저장(동시 4개)들이 같은 임시 파일을 공유한다. 한 저장이 rename으로 옮기면 다른 저장의 rename은 ENOENT가 되고, 서로의 내용을 덮어써 고객사도 뒤바뀐다.
- 근거: src/store/report-archive.js:23 (수정 전). 시계를 멈추고 4개를 동시 저장하는 시험이 수정 전에 같은 ENOENT로 실패하고 수정 후 통과. 시계를 가짜로 쓰는 test/와 지연이 없는 로컬에서는 겹치지 않아 통과하고, ci/는 실제 시계와 지연이라 가끔 같은 ms가 생긴다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름에 reportId를 넣음(`.${reportId}.${stamp}.tmp`). 작업마다 이름이 달라 겹치지 않음. `listReports`(`.`로 시작 제외)와 `strayTemps`(`.tmp`)는 그대로 동작.
- test/archive.test.js — 재현 시험 추가(기존 시험은 변경 없음).

## 재현 테스트
- 위치: test/archive.test.js '보고서 보관: 같은 시각에 동시에 저장해도 서로 덮어쓰지 않는다'
- 수정 전: 실패 (`npm test` → ENOENT ... .tmp, fail 1)
- 수정 후: 통과 (`npm test` → pass 63, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci`(반복), `node --test ci/archive.test.js`(15회)
- 결과: `npm test` 63 통과. `ci/archive.test.js` 15회 모두 실패 0. `npm run test:ci`는 27회 중 약 8회 `ci/batch.test.js`의 '보고서마다 제 작업과 고객사가 붙는다'(report-N이 다른 job에 붙음)로 실패. archive 시험은 한 번도 실패하지 않음.
- 실패 항목: 이번 수정 뒤 실패한 것은 없음. batch.test.js 실패는 이번 수정과 무관한 별개 간헐 실패(비목표, 별도 리뷰 중). 수정 전에도 같은 원인으로 가끔 실패할 것으로 보나 기준 커밋에서 따로 확인하지는 않음.
