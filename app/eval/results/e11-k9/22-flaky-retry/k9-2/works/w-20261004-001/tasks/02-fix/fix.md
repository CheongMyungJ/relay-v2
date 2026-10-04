## 재현
- 재현 절차: `for i in $(seq 20); do node --test ci/batch.test.js; done` (실패 횟수 집계)
- 결과: 재현됨
- 기대: 모든 보고서가 자기 작업(jobId)에 붙는다
- 실제: 20회 중 3회 실패, `expected report-N to belong to job-N, got job-M`

## 원인
- 원인: `runPool`이 결과를 완료 순서대로 `results.push`해서 입력 순서와 어긋나는데, `collectResults`는 `outcomes[i]`를 `jobs[i]`와 인덱스로 짝짓는다. 조회 지연 jitter로 같은 묶음 안의 완료 순서가 바뀌면 기록이 다른 작업에 붙는다.
- 근거: `src/runner/pool.js`의 push, `src/collect/collector.js` `jobs.map((job, i) => toRecord(job, outcomes[i]))`. 지연이 없는 `npm test`는 완료 순서가 거의 입력 순서와 같아 통과한다(지연이 있는 CI 시험에서만 가끔 실패하는 조건과 일치). 실험: 수정 후 ci/batch.test.js 40회 연속 통과(수정 전 3/20 실패), 지연 편차를 강제한 단위 시험이 수정 전 실패 후 통과.
- 사람 추정 판정: 로컬 `npm test`는 늘 통과하고 CI 지연 시험에서만 가끔 실패, 재실행하면 통과 — 맞음 — 지연 jitter가 있을 때만 완료 순서가 뒤바뀌는 위 원인과 일치
- 기각한 가설: 없음

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 입력 순서를 유지, 진행 알림 `done`은 별도 카운터

## 재현 테스트
- 위치: test/pool-order.test.js
- 수정 전: 실패 (`node --test test/pool-order.test.js` → fail 1)
- 수정 후: 통과 (같은 명령 → pass 1)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci`, ci/batch.test.js 40회 반복
- 결과: npm test 63 통과/0 실패, test:ci 67 통과/0 실패, 반복 40회 모두 통과
- 실패 항목: 없음
