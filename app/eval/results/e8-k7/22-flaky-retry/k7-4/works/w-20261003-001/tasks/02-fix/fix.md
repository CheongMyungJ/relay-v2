## 재현
- 재현 절차: `for i in $(seq 1 10); do node --test ci/batch.test.js; done`
- 결과: 재현됨 (10회 중 4회 실패)
- 기대: report-N은 항상 job-N에 속한다
- 실제: `expected report-2 to belong to job-2, got job-1` (report-3/job-2 변형도 있음)

## 원인
- 원인: `runPool`이 결과를 작업이 끝나는 순서대로 `results.push`해서, 같은 묶음 안에서 지연이 다르면 결과 배열 순서가 jobs와 어긋난다. `collectResults`는 `outcomes[i]`를 `jobs[i]`와 짝짓는다고 가정해 기록이 다른 job에 붙는다.
- 근거: `src/runner/pool.js`의 `results.push(result)`, `src/collect/collector.js`의 `jobs.map((job, i) => toRecord(job, outcomes[i]))`. 조회 지연에 지터(±5ms)가 있어 순서가 가끔만 바뀐다. `test/`는 지연이 없어 항상 통과. 수정 뒤 20회 연속 통과로 확인.
- 사람 추정 판정: 재실행하면 통과하므로 타이밍 의존 — 맞음. 끝나는 순서가 타이밍에 따라 바뀌는 것이 원인.
- 기각한 가설: 없음

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 items 순서를 유지, 진행 알림용 `done`은 별도 카운터
- test/pool.test.js — 순서 시험 추가 (기존 시험 변경 없음)

## 재현 테스트
- 위치: test/pool.test.js '결과는 끝나는 순서가 아니라 items 순서다' (지연을 고정해 타이밍과 무관하게 결정적)
- 수정 전: 실패 (`node --test test/pool.test.js` → fail 1)
- 수정 후: 통과 (같은 명령 → pass 5, fail 0)

## 테스트 실행
- 명령: `npm run test:ci`, `npm test`, `ci/batch.test.js` 20회 반복
- 결과: test:ci pass 67 / fail 0, npm test pass 63 / fail 0, 반복 20회 실패 0
- 실패 항목: 없음
