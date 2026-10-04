# fix: runPool이 결과를 입력 순서대로 돌려주게 수정

## 요약
`ci/batch.test.js`가 가끔 `expected report-6 to belong to job-6, got job-5`로 실패하던 간헐 실패를 고쳤다. 시험 재시도, skip, 시간 제한 증가 없이 원인을 코드에서 고쳤다.

## 원인
`runPool`이 결과를 작업이 끝난 순서대로 `push`했는데, `collectResults`는 `jobs[i]`와 `outcomes[i]`를 인덱스로 짝짓는다. 조회 지연이 달라 같은 묶음 안에서 완료 순서가 바뀌면 report가 이웃 job에 붙었다. 지연이 없는 `npm test`는 늘 통과해서 CI 전용 시험에서만 드러났다.

## 변경
- `src/runner/pool.js`: 결과를 `results[start + offset]`에 저장해 입력 순서를 유지한다. `onChunk`의 `done`은 별도 카운터로 센다.
- `test/pool.test.js`: 끝나는 순서가 뒤바뀌는 지연으로 입력 순서를 확인하는 시험을 추가했다.
- `docs/knowledge/`: 간헐 실패 처리 규칙과 `runPool` 결과 순서 항목을 남겼다.

## 테스트
- `npm test`: 63개 통과
- `npm run test:ci`: 67개 통과
- `ci/batch.test.js` 20회 연속 실행: 실패 0
- `test/pool.test.js` 새 케이스: 수정 전 실패, 수정 후 통과
