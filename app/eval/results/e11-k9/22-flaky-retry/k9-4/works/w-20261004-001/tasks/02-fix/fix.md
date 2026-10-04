## 재현
- 재현 절차: `for i in 1 2 3 4 5 6; do node --test ci/batch.test.js; done`
- 결과: 재현됨 (6회 중 3회 실패)
- 기대: `report-N`이 `job-N`에 귀속된다
- 실제: `expected report-4 to belong to job-4, got job-3`, `report-2/job-1`, `report-3/job-2` 등 (이웃 job과 어긋남)

## 원인
- 원인: `runPool`이 각 작업이 끝나는 순서대로 `results.push`해서 결과가 입력 순서와 달라지는데, `collectResults`는 `outcomes[i]`가 `jobs[i]`의 결과라고 가정해 짝짓는다. 조회 지연(jitter)이 있으면 같은 묶음(4개) 안에서 끝나는 순서가 바뀌어 결과가 다른 job에 붙는다.
- 근거: `src/runner/pool.js` push 부분, `src/collect/collector.js` `collectResults`의 인덱스 짝짓기. 지연이 없는 로컬 `npm test`는 순서가 거의 유지돼 통과한다. 수정 뒤 `ci/batch.test.js` 20회, `test:ci` 10회 모두 실패 0. 수정 전 pool 순서 테스트는 실패.
- 사람 추정 판정: 없음 (실패 로그만 제공됨)
- 기각한 가설: 재시도/타임아웃/보관소 임시 파일 경합 — batch 시험은 archive를 쓰지 않고, 어긋남이 순서 문제로 완전히 설명되어 확인하지 않음

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 입력 순서를 보존. 동시 4개 병렬 실행은 그대로.
- test/pool.test.js — 순서 보존 재현 테스트 추가 (기존 테스트는 바꾸지 않음)

## 재현 테스트
- 위치: test/pool.test.js '결과는 끝나는 순서가 아니라 입력 순서다'
- 수정 전: 실패 (`node --test test/pool.test.js` → pass 4, fail 1)
- 수정 후: 통과 (pass 5, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 10회 반복, `node --test ci/batch.test.js` 20회 반복
- 결과: `npm test` pass 63 / fail 0, test:ci 10회 모두 fail 0, batch 20회 모두 fail 0
- 실패 항목: 없음
