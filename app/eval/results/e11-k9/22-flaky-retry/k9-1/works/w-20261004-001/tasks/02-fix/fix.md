## 재현
- 재현 절차: `for i in $(seq 1 10); do node --test ci/batch.test.js; done` (수정 전 코드). `npm run test:ci`를 반복하면 `ci/archive.test.js`도 간헐 실패한다.
- 결과: 재현됨 (batch 10회 중 3회 실패, archive 6회 중 1회 실패)
- 기대: report-N이 항상 job-N의 기록에 붙는다. 보관된 보고서는 제 고객사 것이다.
- 실제: `expected report-3 to belong to job-3, got job-2`. archive는 `ENOENT ... .tmp`, `report-5 보관본의 고객사가 다르다: stark (hooli여야 함)`.

## 원인
- 원인: 원인은 두 가지다. (1) `runPool`이 결과를 끝난 순서대로 `push`하는데 `collectResults`는 인덱스로 job과 짝지어, 조회 지연의 jitter로 끝나는 순서가 바뀌면 report가 다른 job에 붙는다. (2) `saveReport`의 임시 파일 이름이 밀리초 stamp뿐이라 같은 ms에 시작한 동시 저장이 같은 임시 파일을 쓰고 rename해서, 한쪽이 ENOENT로 실패하거나 다른 고객사 내용이 보관된다.
- 근거: `src/runner/pool.js` 의 `results.push(result)` (완료 순서), `src/collect/collector.js` `jobs.map((job, i) => toRecord(job, outcomes[i]))`. `src/store/report-archive.js` `.${stamp(now())}.tmp`. 로컬 `npm test`는 지연이 없어(sleep 0) 끝나는 순서가 시작 순서와 같고, 시험이 임시 파일 경합이 없어 통과한다. CI는 지연+jitter가 있어 순서가 뒤바뀐다. 수정 후 batch 20회, test:ci 30회 모두 통과(실험).
- 사람 추정 판정: "지연 타이밍과 관련 있을 수 있다" — 맞음. 조회 지연의 jitter가 완료 순서를 바꾸는 것이 원인이다. (로컬 통과 설명은 위 근거)
- 기각한 가설: 시험 쪽 문제 — 시험은 올바르게 job-report 짝을 검증하고 있고 제품 코드가 틀렸다.

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 items 순서로 돌려준다. onChunk의 `done`은 별도 카운터로 유지.
- src/store/report-archive.js — 임시 파일 이름에 reportId를 넣어 동시 저장이 겹치지 않게 했다. (범위: 완료조건에 `npm run test:ci` 통과가 있고 같은 증상 계열이라 함께 고침)
- test/pool.test.js, test/archive.test.js — 재현 테스트 추가 (기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/pool.test.js '결과는 먼저 끝난 순서가 아니라 items 순서로 돌려준다', test/archive.test.js '같은 순간에 동시에 저장해도 임시 파일이 겹치지 않는다'
- 수정 전: 실패 (`node --test test/pool.test.js` → fail 1, `node --test test/archive.test.js` → `not ok 10`, fail 1)
- 수정 후: 통과 (두 명령 모두 fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 30회 반복, `node --test ci/batch.test.js` 20회 반복
- 결과: npm test 64 통과 0 실패, test:ci 30회 모두 통과, batch 20회 모두 통과
- 실패 항목: 수정 뒤 실패 없음. 수정 전 ci 실패는 기준 커밋에서 간헐 재현됨.
