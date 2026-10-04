## 재현
- 재현 절차: `for i in $(seq 20); do node --test ci/batch.test.js 2>&1 | grep "^# fail"; done | sort | uniq -c`
- 결과: 재현됨
- 기대: 20회 모두 `# fail 0`
- 실제: 20회 중 9회 실패 (`expected report-N to belong to job-N, got job-M`). 별도로 `ci/archive.test.js`도 기준 커밋에서 20회 중 9회 실패 (보관본 누락/고객사 불일치)

## 원인
- 원인 1 (batch): `runPool`이 끝난 순서대로 결과를 `results.push`한다. 그런데 `collectResults`는 `outcomes[i]`가 `jobs[i]`의 결과라고 가정해 짝짓는다. 조회 지연 jitter 때문에 같은 묶음(동시 4개) 안에서 완료 순서가 바뀌면 결과가 다른 작업에 붙는다.
- 원인 2 (archive): `saveReport`의 임시 파일 이름이 `.${stamp(now())}.tmp`라서 같은 ms에 시작한 동시 저장끼리 이름이 겹친다. 서로 덮어쓰거나 rename이 어긋난다.
- 근거: `src/runner/pool.js` push 줄, `src/collect/collector.js` `jobs.map((job, i) => toRecord(job, outcomes[i]))`. 지연이 없으면 완료 순서가 입력 순서와 같아 로컬 `npm test`는 늘 통과한다. 실험: pool 수정 뒤 `ci/batch.test.js` 30회 연속 통과, 수정 전 20회 중 9회 실패. 임시 이름 수정 뒤 `ci/archive.test.js` 30회 통과 (수정 전 20회 중 9회 실패).
- 사람 추정 판정: "실패는 가끔만 나고 재실행하면 통과한다. 로컬 `npm test`에서는 늘 통과한다" — 맞음. 지연 jitter에 따른 완료 순서에 의존하고, 로컬 시험은 지연이 없어 순서가 안 바뀐다.
- 기각한 가설: 보고서 처리기가 상태를 공유해 섞인다 — `createReportHandler`는 호출마다 지역 변수만 쓰고 payload의 reportId를 그대로 돌려줘 결과 자체는 맞다. 어긋남은 pool 이후 짝짓기 단계에서 생긴다.

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 입력 순서를 유지한다. 진행 알림의 `done`은 별도 카운터. 병렬 실행(동시 4개)은 그대로.
- src/store/report-archive.js — 임시 파일 이름에 reportId를 넣어 동시 저장끼리 겹치지 않게 한다. (`npm run test:ci` 완료조건을 위해 필요했던 별개 원인)
- 기존 테스트 변경은 없음 (시험 파일에 테스트만 추가)

## 재현 테스트
- 위치: `test/pool.test.js` ('결과는 끝나는 순서가 아니라 items 순서다'), `test/archive.test.js` ('같은 시각에 동시에 저장해도 임시 파일 이름이 겹치지 않는다')
- 수정 전: 실패 (`node --test test/pool.test.js` → fail 1, `node --test test/archive.test.js` → fail 1)
- 수정 후: 통과 (`node --test test/pool.test.js` → pass 5, `node --test test/archive.test.js` → pass 10)

## 테스트 실행
- 명령: `npm run test:ci`, `npm test`
- 결과: `npm run test:ci` 5회 연속 fail 0, `npm test` pass 64 / fail 0, test:ci pass 68
- 실패 항목: 수정 뒤 실패 없음. (`ci/archive.test.js`는 기준 커밋에서도 간헐 실패했다)
