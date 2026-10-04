# fix: 밤 배치 간헐 실패 수정 (runPool 결과 순서, 보고서 임시 파일 충돌)

## 요약
CI의 `npm run test:ci`가 가끔 `expected report-6 to belong to job-6, got job-5`로 실패하던 문제를 고쳤다. 같은 시험 묶음의 별도 간헐 실패(보고서 임시 파일 충돌)도 함께 고쳤다. 병렬 4개 실행은 그대로이고 시험 약화는 없다.

## 원인
- `runPool`이 결과를 작업이 끝나는 순서대로 `push`했다. 조회 지연에 지터가 있어 순서가 가끔 바뀌고, `collectResults`가 `outcomes[i]`와 `jobs[i]`를 짝짓는다고 가정해 report가 다른 job에 붙었다.
- `saveReport`의 임시 파일 이름이 시각(ms)만 써서, 같은 ms에 시작한 동시 저장이 같은 임시 파일을 공유해 다른 고객사 보고서를 덮어썼다(ci/archive.test.js 실패).

## 변경
- `src/runner/pool.js`: 결과를 `results[start + i]`에 넣어 items 순서 유지. 진행 알림용 `done`은 별도 카운터.
- `src/store/report-archive.js`: 임시 파일 이름에 reportId 포함.
- 시험 추가: `test/pool.test.js`(순서, onChunk), `test/archive.test.js`(같은 시각 동시 저장). 지연과 시계를 고정해 타이밍과 무관하게 결정적이다.
- `docs/knowledge/`에 팀 규칙과 실패 유형 4건 기록.

## 테스트
- `npm run test:ci` 10회 연속 통과 (pass 69), `npm test` pass 65
- `ci/batch.test.js`, `ci/archive.test.js` 각 20회 반복 실패 0 (수정 전 batch는 10회 중 4회 실패)
