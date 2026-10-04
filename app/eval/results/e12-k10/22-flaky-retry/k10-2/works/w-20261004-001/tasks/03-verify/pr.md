# fix: 배치 결과 순서와 보고서 임시 파일 이름 충돌 수정

## 요약
`ci/batch.test.js`가 가끔 `expected report-6 to belong to job-6, got job-5`로 실패하고 `ci/archive.test.js`도 간헐 실패하던 문제를 원인 코드에서 고쳤다. 시험 재시도, skip, 시간 제한 증가는 쓰지 않았다.

## 원인
- `runPool`이 결과를 끝난 순서대로 push했는데 `collectResults`는 인덱스로 짝짓는다. 지연 jitter로 순서가 바뀌면 보고서가 다른 job에 붙는다.
- `saveReport`의 임시 파일 이름이 밀리초 시각뿐이라 동시 저장이 같은 파일을 공유했다.

## 변경
- `src/runner/pool.js`: 결과를 items 인덱스에 담고 `done`을 `start + chunk.length`로 계산
- `src/store/report-archive.js`: 임시 파일 이름에 reportId 추가
- 재현 테스트 2개 추가, 지식 문서 3개 추가(`docs/knowledge/`)

## 테스트
- `npm test`: 64개 통과
- `npm run test:ci` 20회, `node --test ci/batch.test.js` 20회 모두 통과
