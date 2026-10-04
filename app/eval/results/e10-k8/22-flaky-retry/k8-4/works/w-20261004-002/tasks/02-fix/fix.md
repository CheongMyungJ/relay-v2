## 재현
- 재현 절차: `npm run test:ci`를 반복 실행 (`for i in 1..6; do npm run test:ci; done`)
- 결과: 재현됨 (수정 전 6회 중 2회 실패)
- 기대: 보고서 8개가 모두 저장되고, 보관본마다 제 고객사·합계, 임시 파일 없음
- 실제: `ENOENT: 파일이 없습니다: reports/2026-09/.<꼬리표>.tmp`, `report-3 보관본의 고객사가 다르다: umbrella (initech여야 함)`

## 원인
- 원인: `saveReport`가 임시 파일 이름을 `.${stamp(now())}.tmp`, 즉 ms 시각만으로 만들어서 같은 ms에 시작한 동시 저장(동시 4개)끼리 같은 임시 파일을 쓰고 rename한다. 한쪽이 먼저 rename하면 다른 쪽 rename은 ENOENT가 나고, 덮어쓰기 순서에 따라 다른 고객사의 내용이 제 이름으로 옮겨진다.
- 근거: `src/store/report-archive.js:25`. 실패 로그의 두 작업(job-4, job-2)이 같은 꼬리표 `.mutetsqv.tmp`를 썼다. 시각을 고정하고 4개를 동시에 저장하는 재현 테스트가 수정 전 같은 ENOENT로 실패하고, reportId를 넣으면 통과한다. 지연이 없는 로컬 `npm test`는 저장이 겹치지 않아 통과한다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- `src/store/report-archive.js` — 임시 파일 이름을 `.${reportId}.${stamp}.tmp`로 바꿔 동시 저장끼리 겹치지 않게 했다. 병렬 실행(동시 4개)은 그대로, 보관본 이름과 `listReports`/`strayTemps` 필터(점으로 시작, `.tmp`)는 유지.
- `test/archive.test.js` — 재현 테스트 추가 (기존 테스트 변경 없음).

## 재현 테스트
- 위치: `test/archive.test.js` "보관소: 같은 시각에 동시에 저장해도 임시 파일이 겹치지 않는다"
- 수정 전: 실패 (`node --test test/archive.test.js` → ENOENT ... .tmp)
- 수정 후: 통과 (`node --test test/archive.test.js` → pass 10, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 반복, `node --test ci/archive.test.js` 30회
- 결과: `npm test` 63개 통과. `ci/archive.test.js` 단독 30회 중 30회 통과. `npm run test:ci` 30회 중 보관소 관련 실패 0회 (전체 통과는 20회 중 17회, 앞 20회 실행 기준).
- 실패 항목: 남은 실패는 `ci/batch.test.js`의 `expected report-N to belong to job-N` (기준 커밋에서도 20회 중 4회 실패, 수정 후 20회 중 4회로 같음). 비목표로 따로 리뷰 중.
