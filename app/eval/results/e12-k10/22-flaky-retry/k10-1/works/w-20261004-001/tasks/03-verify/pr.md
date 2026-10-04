# fix: 병렬 실행 결과를 items 순서로 두고 보고서 임시 파일 이름이 겹치지 않게 한다

## 요약
CI(`npm run test:ci`)에서 간헐적으로 `expected report-6 to belong to job-6, got job-5`가 나던 문제를 고쳤다. 동시 4개 병렬 실행은 그대로다.

## 원인
1. `runPool`이 결과를 끝난 순서로 쌓는데 `collectResults`는 인덱스로 job과 짝지어, 지연 때문에 완료 순서가 바뀌면 report가 다른 job에 붙었다.
2. `saveReport`의 임시 파일 이름이 ms 시각뿐이라 같은 ms에 시작한 동시 저장이 서로의 임시 파일을 가져갔다.

## 변경
- `src/runner/pool.js`: 결과를 `results[start + i]`에 제자리 저장
- `src/store/report-archive.js`: 임시 파일 이름에 `reportId` 추가
- `test/pool.test.js`, `test/archive.test.js`: 재현 시험 추가

## 테스트
- `npm test` 64 통과
- `npm run test:ci` 30/30 통과 (수정 전 10회 중 6회 실패)
- `node --test ci/batch.test.js` 20/20 통과
