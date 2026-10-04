## 재현
- 재현 절차: `for i in $(seq 30); do node --test ci/batch.test.js; done` (실패 횟수 집계)
- 결과: 재현됨
- 기대: 30회 모두 통과, `report-N`은 `job-N`에 붙음
- 실제: 30회 중 6회 실패 (`expected report-6 to belong to job-6, got job-5` 형태)

## 원인
- 원인: `runPool`이 결과를 `results.push`로 끝난 순서대로 쌓는데, `collectResults`는 `outcomes[i]`를 `jobs[i]`와 index로 짝짓는다. 조회 지연(jitter)으로 완료 순서가 바뀌면 다른 작업의 결과가 붙는다.
- 근거: `src/runner/pool.js`(push), `src/collect/collector.js`의 `jobs.map((job, i) => toRecord(job, outcomes[i]))`. 지연이 없는 로컬 `npm test`는 완료 순서가 거의 입력 순서와 같아 통과한다. 수정 후 30회 연속 통과.
- 사람 추정 판정: 추정 — 맞음 — "로컬은 통과, CI(지연 있음)에서만 가끔 실패"는 완료 순서가 지연에 따라 바뀐다는 원인과 일치
- 기각한 가설: 없음

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 index로 저장해 items와 같은 순서로 돌려준다. 병렬(동시 4개)은 그대로, `onChunk`의 `done`은 카운터로 유지.
- test/pool.test.js — 순서 보존 시험 추가 (기존 시험은 변경 없음)

## 재현 테스트
- 위치: test/pool.test.js '결과는 끝난 순서가 아니라 items 순서대로 돌려준다'
- 수정 전: 실패 (`node --test test/pool.test.js` → pass 4, fail 1)
- 수정 후: 통과 (pass 5, fail 0)

## 테스트 실행
- 명령: `npm run test:ci`, `npm test`, `ci/batch.test.js` 30회 반복
- 결과: test:ci pass 67 / fail 0, npm test pass 63 / fail 0, 반복 30회 중 실패 0
- 실패 항목: 없음
