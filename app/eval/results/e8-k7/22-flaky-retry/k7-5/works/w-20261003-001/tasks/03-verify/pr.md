# fix: runPool 결과를 입력 순서로 모으고 보고서 임시 파일 이름이 겹치지 않게 한다

## 요약
CI 시험 `ci/batch.test.js`가 가끔 `expected report-6 to belong to job-6, got job-5`로 실패하던 문제를 고쳤다. 같은 test:ci의 `ci/archive.test.js` 간헐 실패도 함께 고쳤다. 병렬 실행(동시 4개)은 유지한다.

## 원인
- batch: `runPool`이 끝난 순서대로 `results.push`하는데 `collectResults`는 `outcomes[i]`를 `jobs[i]`의 결과로 짝짓는다. 조회 지연 jitter로 묶음 안 완료 순서가 바뀌면 결과가 다른 작업에 붙는다. 로컬 `npm test`는 지연이 없어 못 잡는다.
- archive: `saveReport`의 임시 파일 이름이 시각 꼬리표만이라 같은 ms의 동시 저장끼리 겹친다.

## 변경
- `src/runner/pool.js`: 결과를 `results[start + i]`에 넣어 입력 순서를 유지한다. `onChunk`의 `done`은 별도 카운터.
- `src/store/report-archive.js`: 임시 파일 이름에 reportId를 넣는다.
- `docs/knowledge/`: 이번에 알게 된 규칙과 실패 유형 4건.

## 테스트
- `test/pool.test.js`, `test/archive.test.js`에 재현 테스트 추가 (수정 전 실패, 후 통과)
- `ci/batch.test.js`, `ci/archive.test.js` 각 25회 연속 통과 (수정 전 20회 중 9회 실패)
- `npm run test:ci` pass 68, `npm test` pass 64
