# fix: runPool이 결과를 입력 순서대로 돌려주게 수정

## 요약
CI 전용 `ci/batch.test.js`가 가끔 `expected report-6 to belong to job-6, got job-5`로 실패하던 문제를 고친다. 병렬 실행(동시 4개)은 그대로 유지한다.

## 원인
`runPool`이 결과를 완료 순서대로 `results.push`했다. `collectResults`는 인덱스로 job과 결과를 짝지으므로, 같은 묶음 안에서 지연이 짧은 작업이 먼저 끝나면 다른 job의 결과가 붙었다. 지연이 없는 로컬 시험에서는 드러나지 않았다.

## 변경
- `src/runner/pool.js`: 결과를 `results[start + i]`에 넣어 입력 순서를 보존한다. `onChunk`의 `done`은 별도 카운터로 유지한다.
- `test/pool.test.js`: 완료 순서와 입력 순서가 다른 지연으로 순서 보존을 확인하는 테스트 추가.
- `docs/knowledge/`: runPool 결과 순서 규칙과 flaky 시험 처리 방침 기록.

## 테스트
- `npm test` 63 통과, `npm run test:ci` 67 통과
- `ci/batch.test.js` 20회 연속 통과 (수정 전 10회 중 5회 실패)
- 재시도·skip·시간 제한 변경 없음
