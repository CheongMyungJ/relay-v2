# runPool: 결과를 완료 순서가 아니라 입력 순서로 돌려준다

## 요약
밤 배치에서 조회 지연이 있으면 보고서가 옆 작업에 붙던 문제를 고쳤다. CI의 `ci/batch.test.js`가 가끔 `expected report-6 to belong to job-6, got job-5`로 실패하던 원인이다.

## 원인
`runPool`이 결과를 작업이 끝난 순서로 `push`했는데, `collectResults`는 `outcomes[i]`를 `jobs[i]`와 인덱스로 짝짓는다. 한 묶음(4개) 안에서 지연 때문에 완료 순서가 바뀌면 결과가 옆 작업에 붙었다.

## 변경
- `src/runner/pool.js`: 결과를 `results[start + i]`, 곧 입력 위치에 저장한다. 병렬(동시 4개)은 그대로이고 `onChunk`의 `done` 값도 같다.
- `test/pool.test.js`: 완료 순서가 바뀌는 지연([30,5,20,1,10])으로 입력 순서를 검사하는 결정적 회귀 시험 추가.
- `docs/knowledge/`: runPool 순서·병렬 유지 규칙, flaky 시험 처리 규칙 추가.

## 테스트
- `npm test` 63 통과, `npm run test:ci` 67 통과
- `node --test ci/batch.test.js` 20회 반복 20회 통과 (수정 전에는 10회 중 3회 실패)
- 회귀 시험은 수정 전 코드에서 실패, 수정 후 통과
