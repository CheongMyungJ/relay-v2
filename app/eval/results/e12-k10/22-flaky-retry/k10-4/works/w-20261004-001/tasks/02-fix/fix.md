## 재현
- 재현 절차: `for i in $(seq 1 10); do node --test ci/batch.test.js; done`
- 결과: 재현됨
- 기대: 모든 보고서가 자기 작업에 붙는다 (10회 모두 통과)
- 실제: 10회 중 3회 실패. `expected report-7 to belong to job-7, got job-6`, `report-4 ... job-3`, `report-8 ... job-7`

## 원인
- 원인: `runPool`이 결과를 작업이 끝난 순서로 `results.push`하는데, `collectResults`(`src/collect/collector.js`)는 `outcomes[i]`를 `jobs[i]`와 인덱스로 짝짓는다. 묶음(4개) 안에서 조회 지연 때문에 완료 순서가 바뀌면 결과가 옆 작업에 붙는다.
- 근거: `src/runner/pool.js` push 위치, `collector.js:34` 인덱스 짝짓기. 실패 메시지가 항상 바로 앞 작업 번호(job-N-1)인 것도 인접 swap과 맞다. 지연·지터가 작으면 순서가 안 바뀌어 통과하므로 간헐적이다. 수정 후 입력 위치에 저장하자 30회 모두 통과했다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음 (시험 쪽 문제 — 시험은 제품 결과를 옳게 검사하고 있어 기각)

## 변경 요약
- `src/runner/pool.js` — 결과를 `results[start + i]`에 넣어 입력 순서를 보장. 병렬(동시 4개)은 그대로. `done` 카운터를 따로 두어 onChunk 값은 동일.
- `test/pool.test.js` — 회귀 시험 추가 (기존 시험은 변경 없음)

## 재현 테스트
- 위치: `test/pool.test.js` '결과는 작업이 끝난 순서가 아니라 입력 순서대로' (지연 [30,5,20,1,10], 결정적)
- 수정 전: 실패 (`node --test test/pool.test.js` → pass 4, fail 1)
- 수정 후: 통과 (pass 5, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci`, `node --test ci/batch.test.js` 30회 반복
- 결과: npm test 63 통과/0 실패, test:ci 67 통과/0 실패, batch 30회 중 30회 통과
- 실패 항목: 없음
