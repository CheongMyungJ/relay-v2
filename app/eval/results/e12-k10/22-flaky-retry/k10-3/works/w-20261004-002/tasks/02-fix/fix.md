## 재현
- 재현 절차: `for i in $(seq 10); do node --test ci/archive.test.js; done`
- 결과: 재현됨 (10회 중 3회 실패)
- 기대: 항상 통과
- 실제: `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp` 등으로 2개 시험 모두 실패

## 원인
- 원인: `saveReport`가 임시 파일 이름을 현재 시각(ms) 36진수 꼬리표만으로 만든다(`src/store/report-archive.js`). 같은 기간 폴더에서 동시 4개 저장이 같은 ms에 시작하면 같은 임시 이름을 쓰고, 먼저 끝난 쪽이 rename으로 옮기면 나머지는 ENOENT가 나거나 남의 내용(다른 고객사)을 제 이름으로 옮긴다.
- 근거: 시계를 고정해 4개를 동시에 저장하는 시험이 수정 전 `ENOENT ... .muovznk0.tmp`로 실패하고 수정 후 통과. 실패 로그의 ENOENT와 고객사 불일치(wayne/stark)가 모두 이 충돌로 설명된다. 지연이 없는 `npm test`에서는 저장이 겹치지 않아 안 드러난다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름을 `.<reportId>.<시각>-<호출 순번>.tmp`로 바꿔 같은 reportId를 같은 ms에 저장해도 겹치지 않게 함. `listReports`/`strayTemps`가 쓰는 규칙(`.` 시작, `.tmp` 끝)은 유지.
- test/archive.test.js — 재현 시험 추가(기존 시험은 변경 없음).

## 재현 테스트
- 위치: test/archive.test.js `보관소: 같은 시각에 동시에 저장해도 임시 파일이 겹치지 않는다`
- 수정 전: 실패 (`npm test` → `not ok 10`, `ENOENT ... .muovznk0.tmp`)
- 수정 후: 통과 (`npm test` → pass 63, fail 0)

## 테스트 실행
- 명령: `npm test`; `node --test ci/archive.test.js` 20회; `npm run test:ci` 10회
- 결과: `npm test` 통과(63/63). `ci/archive.test.js` 20회 중 통과 20, 실패 0. `npm run test:ci` 10회 중 통과 7, 실패 3.
- 실패 항목: 실패 3건은 모두 `ci/batch.test.js`의 `밤 배치: 보고서마다 제 작업과 고객사가 붙는다`(report-N이 job-(N-1)에 붙음). 기준 커밋에서도 실패함(8회 중 3회). 비목표(별도 Work에서 수정·리뷰 중)라 건드리지 않음. 따라서 완료조건 "`npm run test:ci` 통과"는 batch 간헐 실패가 머지되기 전까지 충족되지 않는다.
