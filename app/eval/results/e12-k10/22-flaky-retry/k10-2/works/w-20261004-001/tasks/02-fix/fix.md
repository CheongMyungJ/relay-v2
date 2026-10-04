## 재현
- 재현 절차: `npm run test:ci`를 5~15회 반복 실행 (`node --test ci/batch.test.js`도 가끔 실패)
- 결과: 재현됨 (5회 중 2회 실패)
- 기대: report-N은 항상 job-N에 속하고, test:ci가 매번 통과
- 실제: `expected report-6 to belong to job-6, got job-5`. 반복 중 `ci/archive.test.js`도 실패함 (임시 파일 ENOENT, `report-4 보관본의 고객사가 다르다: initech (umbrella여야 함)`)

## 원인
- 원인 1 (batch): `runPool`이 결과를 끝난 순서대로 `push`하는데, `collectResults`는 인덱스로 작업과 짝짓는다. 조회 지연의 jitter로 끝나는 순서가 바뀌면 기록이 다른 job에 붙는다. 지연이 없는 로컬 `npm test`는 순서가 우연히 유지돼 늘 통과한다.
- 원인 2 (archive): `saveReport`의 임시 파일 이름이 `.${stamp(now())}.tmp`로 밀리초 시각뿐이라, 같은 밀리초에 동시에 저장하면 같은 임시 파일을 공유한다. 서로 덮어쓰고, 한쪽이 먼저 rename하면 다른 쪽 rename은 ENOENT가 되며 보관본이 다른 고객사 것이 된다.
- 근거: src/runner/pool.js `results.push`, src/collect/collector.js `outcomes[i]`, src/store/report-archive.js 임시 이름. 수정 전 재현 테스트 2개가 결정적으로 실패하고 수정 후 통과. 수정 뒤 `test:ci` 30회, batch 시험 20회 모두 통과.
- 사람 추정 판정: "로컬은 늘 통과, CI만 가끔 실패, 재실행하면 통과" — 맞음. 지연 jitter에 따른 완료 순서/시각 경쟁이라 그렇다.
- 기각한 가설: 없음

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 담아 items 순서를 지키고, onChunk의 `done`은 `start + chunk.length`로 계산
- src/store/report-archive.js — 임시 파일 이름에 reportId를 넣어 동시 저장 시 겹치지 않게 함
- test/pool.test.js, test/archive.test.js — 재현 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/pool.test.js '결과는 끝난 순서가 아니라 items 순서다', test/archive.test.js '같은 시각에 동시에 저장해도 보고서가 서로 섞이지 않는다'
- 수정 전: 실패 (`node --test test/pool.test.js` → fail 1, `node --test test/archive.test.js` → fail 1)
- 수정 후: 통과 (각각 fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 30회 반복, `node --test ci/batch.test.js` 20회 반복
- 결과: 모두 통과 (실패 0)
- 실패 항목: 기준 커밋에서도 실패 (batch, archive 둘 다 기준 커밋에서 간헐 실패). 이번 수정 뒤 실패 없음
