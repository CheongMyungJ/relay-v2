## 재현
- 재현 절차: 기준 커밋에서 `for i in $(seq 8); do node --test ci/batch.test.js; done`, 그리고 `npm run test:ci`를 10번 반복
- 결과: 재현됨
- 기대: report-N이 항상 job-N에 속하고 `npm run test:ci`가 통과한다
- 실제: `expected report-2 to belong to job-2, got job-1`, `expected report-6 to belong to job-6, got job-5` 등으로 8회 중 4회 실패. 기준 커밋의 `test:ci`는 10회 중 8회 실패. `ci/archive.test.js`도 20회 중 9회 실패했다(`ENOENT ... .tmp`, `report-3 보관본의 고객사가 다르다`).

## 원인
- 원인: (1) `runPool`이 작업이 끝난 순서대로 결과를 `push`하는데, `collectResults`는 인덱스로 작업과 짝짓는다. 지연이 있으면 끝나는 순서가 입력 순서와 달라져 기록이 다른 작업에 붙는다. (2) `saveReport`의 임시 파일 이름이 `stamp(now())`뿐이라 동시에 같은 ms에 저장하는 두 보고서가 같은 임시 파일을 쓰고, 한쪽 rename이 다른 쪽 파일을 가져가거나 없앤다.
- 근거: `src/runner/pool.js`의 `results.push`와 `src/collect/collector.js` `jobs.map((job, i) => toRecord(job, outcomes[i]))`. 로컬 `npm test`는 지연이 없어 순서가 유지돼 통과한다. 수정 전 재현 테스트 2개가 실패하고 수정 후 통과했다. 수정 뒤 `ci/batch.test.js` 20/20, `npm run test:ci` 20/20 통과.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 입력 순서를 유지. 동시 4개는 그대로.
- src/store/report-archive.js — 임시 파일 이름에 reportId를 넣어 동시 저장이 겹치지 않게 함. `ci/archive.test.js`가 `test:ci`에 포함돼 있어 같이 고침.
- test/pool.test.js, test/archive.test.js — 재현 테스트 추가(기존 테스트는 바꾸지 않음).

## 재현 테스트
- 위치: test/pool.test.js '늦게 끝나는 작업이 있어도 결과는 입력 순서와 같다', test/archive.test.js '보관소: 같은 시각에 동시에 저장해도 임시 파일이 겹치지 않는다'
- 수정 전: 실패 (`node --test test/pool.test.js test/archive.test.js` → 2건 실패, 15개 중 13 통과)
- 수정 후: 통과 (같은 명령 → 15 통과, 0 실패)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 20회 반복, `ci/batch.test.js` 20회 반복
- 결과: `npm test` 64 통과 0 실패. `test:ci` 20회 모두 통과. `batch.test.js` 20/20 통과.
- 실패 항목: 없음 (수정 전에는 기준 커밋에서도 실패했던 것들)
