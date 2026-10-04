## 재현
- 재현 절차: `for i in $(seq 8); do node --test ci/batch.test.js; done` (조회 지연 `baseMs 10, perRowMs 0.25, jitterMs 5` 조건)
- 결과: 재현됨 (8회 중 2회 실패)
- 기대: 모든 report가 자기 job에 대응
- 실제: `expected report-6 to belong to job-6, got job-5`, `expected report-3 to belong to job-3, got job-2`

## 원인
- 원인: `runPool`이 결과를 작업이 끝난 순서대로 `results.push`하는데, `collectResults`는 `jobs[i]`와 `outcomes[i]`를 인덱스로 짝짓는다. 조회 지연(tenant별 행 수 + jitter)이 달라 같은 묶음 안에서 완료 순서가 바뀌면 report가 이웃 job에 붙는다.
- 근거: `src/runner/pool.js` push 부분, `src/collect/collector.js` `jobs.map((job, i) => toRecord(job, outcomes[i]))`. 지연이 없는 `npm test`는 완료 순서가 입력 순서와 같아 늘 통과하고, jitter가 있는 `ci/`에서만 간헐 실패한다. 수정 뒤 30회 연속 통과, 순서를 뒤바꾸는 단위 시험은 수정 전 실패.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- `src/runner/pool.js` — 결과를 `results[start + offset]`에 넣어 입력 순서를 유지. `onChunk`의 `done`은 별도 카운터로 계산(동작 동일).

## 재현 테스트
- 위치: `test/pool.test.js` '결과는 먼저 끝난 순서가 아니라 입력 순서다'
- 수정 전: 실패 (`node --test test/pool.test.js` → pass 4, fail 1)
- 수정 후: 통과 (pass 5, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci`, `ci/batch.test.js` 30회 반복
- 결과: npm test 63 통과, test:ci 67 통과, 반복 30회 중 실패 0
- 실패 항목: 없음
