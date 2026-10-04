## 재현
- 재현 절차: `for i in $(seq 1 10); do npm run test:ci; done` (수정 전)
- 결과: 재현됨
- 기대: ci/batch.test.js가 매번 통과
- 실제: 10회 중 3회 실패 — `expected report-2 to belong to job-2, got job-1` 등 (보고서가 다른 작업의 기록에 붙음)

## 원인
- 원인: `runPool`이 `results.push`로 완료 순서대로 결과를 넣는데, `collectResults`는 `outcomes[i]`를 `jobs[i]`와 인덱스로 짝짓는다. 조회 지연이 작업마다 달라 같은 묶음 안에서 완료 순서가 바뀌면 작업과 결과가 어긋난다.
- 근거: src/runner/pool.js(수정 전 18행 부근) push, src/collect/collector.js `collectResults`. 지연 없는 `npm test`는 완료 순서가 입력 순서와 같아 통과함. 새 결정적 시험(지연 30,5,20,1,10ms)이 수정 전 실패, 수정 후 통과.
- 사람 추정 판정: "runPool 결과가 입력 순서가 아니라 작업과 어긋난다" — 맞음 (위 재현과 시험으로 확인). 그 밖의 추정 없음
- 기각한 가설: 없음 (이전 시도의 "runPool은 archive 실패와 무관" 판단은 archive 한정으로는 맞고, 이번 사람 지시 범위의 batch 실패 원인임)

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 입력 순서를 보장하고, onChunk `done`은 별도 카운터로 센다. 동시 4개 병렬은 그대로.
- test/pool.test.js — 입력 순서 시험과 done 카운터 시험 추가 (기존 시험은 변경 없음)
- 이전 커밋의 saveReport 임시 파일 이름 수정은 그대로 둠

## 재현 테스트
- 위치: test/pool.test.js '결과는 완료 순서가 아니라 입력 순서다' (done 시험은 회귀 방지용이라 수정 전에도 통과)
- 수정 전: 실패 (`node --test test/pool.test.js` → not ok 5, fail 1)
- 수정 후: 통과 (같은 명령 → pass 6, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 20회 반복
- 결과: npm test 65 통과 0 실패. test:ci 20회 중 실패 0회 (회당 69 통과). 시험에 재시도·skip·시간 제한·LATENCY 변경 없음.
- 실패 항목: 없음
