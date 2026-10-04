## 재현
- 재현 절차: `for i in $(seq 10); do node --test ci/batch.test.js; done` (수정 전)
- 결과: 재현됨
- 기대: 각 report가 자기 job에 속한다
- 실제: 10회 중 5회 실패 (`expected report-N to belong to job-N, got job-M`)

## 원인
- 원인: `runPool`이 결과를 완료 순서대로 `results.push`해, 입력 순서와 어긋난다. `collectResults`는 인덱스로 job과 결과를 짝지으므로, 같은 묶음(동시 4개) 안에서 지연이 짧은 작업이 먼저 끝나면 다른 job의 결과가 붙는다.
- 근거: `src/runner/pool.js`의 `results.push(result)`, `src/collect/collector.js`의 `outcomes[i]` 짝짓기. 조회 지연이 행 수와 지터에 따라 달라 CI 시험(지연 있음)에서만 가끔 순서가 바뀐다. 로컬 시험은 지연이 없어 완료 순서 = 입력 순서. 수정 후 20회 연속 통과.
- 사람 추정 판정: "로컬은 늘 통과하고 CI만 가끔 실패" — 맞음 — 지연이 없으면 완료 순서가 입력 순서와 같아 가려진다.
- 기각한 가설: 없음

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 입력 순서를 유지. `onChunk`의 `done`은 별도 카운터로 유지. 동시 4개 병렬은 그대로.

## 재현 테스트
- 위치: test/pool.test.js '결과는 끝난 순서가 아니라 입력 순서다'
- 수정 전: 실패 (`node --test test/pool.test.js` → fail 1)
- 수정 후: 통과 (pass 5, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci`, `ci/batch.test.js` 20회 반복
- 결과: 63 통과 / 67 통과 / 20회 모두 fail 0
- 실패 항목: 없음
