## 재현
- 재현 절차: `for i in $(seq 1 8); do node --test ci/archive.test.js; done` (작업 디렉터리: 워크트리)
- 결과: 재현됨 (8회 중 1회 실패)
- 기대: 보고서 8개가 모두 보관되고 고객사와 합계가 맞음
- 실제: `ENOENT: 파일이 없습니다: reports/2026-09/.mutlput2.tmp` (job-2, job-8)와 `report-1 보관본의 고객사가 다르다: globex (acme여야 함)`

## 원인
- 원인: `saveReport`의 임시 파일 이름이 시각 stamp만으로 정해져(`.<stamp>.tmp`), 같은 ms에 동시에 저장하는 보고서들이 같은 임시 파일을 덮어쓴다. 먼저 끝난 쪽이 rename으로 파일을 가져가면 나머지는 ENOENT로 실패하고, 덮어써진 내용이 다른 보고서 이름으로 옮겨지면 고객사가 뒤바뀐다.
- 근거: `src/store/report-archive.js:23`의 이름에 reportId가 없음. 동시 4개 실행(concurrency)과 지연 jitter 때문에 같은 ms가 가끔 생겨 간헐적으로만 실패하고, 겹치지 않으면 통과한다(실패 증상 두 가지가 한 원인으로 설명됨). 시각을 고정한 시험이 수정 전 같은 ENOENT로 실패하고 수정 뒤 통과함.
- 사람 추정 판정: 없음 (추가 의견은 "실패 로그가 실행마다 조금씩 다르다"는 관찰뿐이며, 충돌하는 보고서와 시각이 매번 달라서라는 점과 맞음)
- 기각한 가설: runPool 결과 순서(팀 지식) — 이 시험은 보관본을 reportId로 찾아 읽고 outcomes 인덱스에 의존하지 않아 증상과 무관. 수정 뒤 `ci/archive.test.js`는 40회 연속 통과.

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름을 `.<reportId>.<stamp>.tmp`로 바꿔 동시 저장 충돌 제거
- test/archive.test.js — 시각을 고정하고 보고서 4개를 동시에 저장하는 재현 시험 추가 (기존 시험은 바꾸지 않음)

## 재현 테스트
- 위치: test/archive.test.js `보고서 보관: 같은 ms에 여러 보고서를 동시에 저장해도 서로 덮어쓰지 않는다`
- 수정 전: 실패 (`npm test` → `ENOENT: 파일이 없습니다: reports/2026-09/.muovznk0.tmp`, fail 1)
- 수정 후: 통과 (`npm test` → pass 63, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 30회 반복, `node --test ci/archive.test.js` 40회와 20회 반복
- 결과: `npm test` 통과. `ci/archive.test.js`는 60회 모두 통과. `npm run test:ci`는 30회 중 9회 실패했는데 `ci/batch.test.js`(비목표)의 실패였다(예: `밤 배치: 보고서마다 제 작업과 고객사가 붙는다`).
- 실패 항목: `ci/batch.test.js` — 이번 수정으로 생긴 실패가 아니다. 기준 커밋에서도 같은 원인(runPool 순서)으로 간헐 실패할 것으로 보이나 기준 커밋에서 따로 돌려 확인하지는 않았다. 비목표라 고치지 않았다.
