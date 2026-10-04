# fix: 배치 결과 순서와 보고서 임시 파일 이름 충돌 수정

## 요약
`npm run test:ci`에서 `ci/batch.test.js`가 간헐적으로 실패하던 문제(`expected report-6 to belong to job-6, got job-5`)를 src에서 고쳤다. 시험에는 재시도, skip, 시간 제한 증가를 넣지 않았다.

## 원인
- `runPool`이 결과를 작업 완료 순서로 `push`했는데 `collectResults`는 인덱스로 job과 짝지어, 지연으로 완료 순서가 바뀌면 report가 다른 job에 붙었다.
- `saveReport`의 임시 파일 이름이 시각만 써서, 같은 ms에 동시 저장하면 이름이 겹쳤다(`ci/archive.test.js` 간헐 실패).

## 변경
- `src/runner/pool.js`: 결과를 `results[start + i]`에 담아 입력 순서 유지. `done`은 별도 카운터.
- `src/store/report-archive.js`: 임시 파일 이름에 reportId 추가.
- `test/pool.test.js`, `test/archive.test.js`: 재현 테스트 추가.
- `docs/knowledge/`: flaky 시험 정책, 동시 실행 함정 기록.

## 테스트
- `npm test`: pass 64, fail 0
- `npm run test:ci` 15회, `node --test ci/batch.test.js` 15회: 실패 0
