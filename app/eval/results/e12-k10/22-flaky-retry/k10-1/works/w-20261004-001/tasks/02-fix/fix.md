## 재현
- 재현 절차: 수정 전 코드에서 `for i in $(seq 10); do npm run test:ci; done` (또는 `node --test ci/batch.test.js`를 반복)
- 결과: 재현됨
- 기대: 모든 report가 자기 job에 대응하고 `test:ci`가 항상 통과
- 실제: 10회 중 6회 실패. `ci/batch.test.js`의 job/report 불일치, 그리고 `ci/archive.test.js`의 `ENOENT ... .tmp`와 `report-3 보관본의 고객사가 다르다: umbrella (initech여야 함)`

## 원인
- 원인: 원인이 두 개다. (1) `runPool`이 결과를 끝난 순서로 `results.push`하는데 `collectResults`는 인덱스로 job과 짝지어, 조회 지연 지터 때문에 완료 순서가 바뀌면 report가 다른 job에 붙는다. (2) `saveReport`의 임시 파일 이름이 `stamp(now())`(ms)뿐이라 같은 ms에 시작한 동시 저장이 같은 임시 파일을 쓰고 서로 rename해 가, ENOENT나 다른 고객사의 보고서가 저장된다.
- 근거: `src/runner/pool.js` push 위치와 `src/collect/collector.js` `jobs.map((job, i) => toRecord(job, outcomes[i]))`. 수정 전 test:ci가 실행마다 달랐고, 순서 보존만 고친 뒤에도 archive 시험이 8/20회 실패해 (2)를 확인. 두 수정 후 test:ci 30/30 통과. 지연이 없는 로컬 `npm test`는 완료 순서가 거의 항상 입력 순서와 같아 통과한다.
- 사람 추정 판정: 없음
- 기각한 가설: 동시 실행 수 문제(순차화) — 사람이 금지했고 원인도 병렬 자체가 아니라 순서 가정과 임시 파일 이름 충돌이다. 재시도/시간 제한 — 비목표.

## 변경 요약
- `src/runner/pool.js` — 결과를 `results[start + i]`에 제자리에 저장. `onChunk`의 `done`은 `start + chunk.length`로. 동시 4개 유지.
- `src/store/report-archive.js` — 임시 파일 이름에 `reportId`를 넣어 동시 저장이 겹치지 않게 함.
- `test/pool.test.js`, `test/archive.test.js` — 재현 테스트 추가 (기존 테스트는 수정하지 않음)

## 재현 테스트
- 위치: `test/pool.test.js` "결과는 끝난 순서가 아니라 items 순서다", `test/archive.test.js` "같은 시각에 동시에 저장해도 ..."
- 수정 전: 실패 (`node --test test/pool.test.js` → pass 4 / fail 1, `node --test test/archive.test.js` → pass 9 / fail 1)
- 수정 후: 통과 (pool 5/5, archive 10/10)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 30회, `node --test ci/batch.test.js` 20회
- 결과: `npm test` 64 통과 0 실패. `test:ci` 30/30 통과. `batch.test.js` 20/20 통과
- 실패 항목: 없음 (수정 전 실패는 기준 커밋에서도 재현됨)
