# fix: 배치 결과 순서와 보고서 임시 파일 이름 충돌 수정

## 요약
`npm run test:ci`에서 `ci/batch.test.js` 등이 간헐적으로 실패하던 문제를 고쳤다. 병렬 실행(동시 4개)은 그대로 유지한다.

## 원인
1. `runPool`이 결과를 끝난 순서로 `push`하는데 `collectResults`는 `outcomes[i]`를 `jobs[i]`와 인덱스로 짝짓는다. 지연 jitter로 순서가 바뀌면 보고서가 다른 작업에 붙었다.
2. `saveReport`의 임시 파일 이름이 시각만 써서, 같은 ms에 동시 저장하면 파일이 겹쳐 덮어써지거나 `rename`이 실패했다.

## 변경
- `src/runner/pool.js`: 결과를 `results[start + i]`에 넣어 입력 순서 유지, `done`은 카운터로 계산.
- `src/store/report-archive.js`: 임시 파일 이름에 reportId 포함.
- `test/pool.test.js`, `test/archive.test.js`: 재현 테스트 추가.
- `docs/knowledge/`: 배운 점 기록.

## 테스트
- `npm test`: 64 통과
- `npm run test:ci` 반복: 30/30 통과 (수정 전 10번 중 7번 실패)
- 위험: 임시 파일 이름 형식이 바뀌었다. 같은 reportId의 동시 저장은 보호하지 않는다.
