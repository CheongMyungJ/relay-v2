# fix: 배치 결과를 입력 순서로 돌려주고 보고서 임시 파일 이름이 겹치지 않게 한다

## 요약
`ci/batch.test.js`가 간헐적으로 `expected report-N to belong to job-N, got job-(N-1)`로 실패하던 문제를 고쳤다.

## 원인
- `runPool`이 결과를 끝난 순서로 모았는데 `collectResults`는 인덱스로 job과 짝짓는다. 지연이 흔들리면 report가 다른 job에 붙었다.
- `saveReport`의 임시 파일 이름이 ms 시각뿐이라 같은 ms에 저장하는 작업끼리 겹쳤다.

## 변경
- `src/runner/pool.js`: 결과를 입력 순서 자리(`results[start + i]`)에 둔다.
- `src/store/report-archive.js`: 임시 파일 이름에 reportId를 넣는다.
- 시험 추가: `test/pool.test.js`, `test/archive.test.js`. 재시도·skip·시간 제한 변경은 없다.

## 테스트
- `npm run test:ci` 30회 반복 모두 통과 (수정 전 8회 중 5회 실패)
- `npm test` 64 통과
- 새 시험 2개는 수정 전 코드에서 실패한다.
