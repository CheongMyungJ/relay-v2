## 재현
- 재현 절차: `for i in $(seq 1 6); do npm run test:ci 2>&1 | grep -E "^# (pass|fail)|expected report"; done` (기준 커밋)
- 결과: 재현됨
- 기대: 반복해도 `# fail 0`
- 실제: 6회 중 4회 실패 (`# fail 1~2`). 실패는 두 가지였다: `ci/batch.test.js`의 `report-N`/`job-N` 불일치, `ci/archive.test.js`의 보관 실패(`expected: 0`)

## 원인
- 원인: 원인이 둘이다. (1) `runPool`이 결과를 완료 순서로 `push`하는데 `collectResults`는 인덱스로 job과 짝짓는다. 지연 때문에 완료 순서가 바뀌면 report가 다른 job에 붙는다. (2) `saveReport`의 임시 파일 이름이 `.${stamp(now())}.tmp`라 같은 ms에 동시에 저장하는 보고서끼리 이름이 같아, 서로 덮어쓰거나 rename이 ENOENT로 실패한다.
- 근거: `src/runner/pool.js` 17-19행(`results.push`), `src/collect/collector.js:36`(`outcomes[i]`). `src/store/report-archive.js:23`의 임시 이름. 시계를 고정한 동시 저장 시험에서 `ENOENT: reports/2026-09/.mg5wnj94.tmp`로 재현. (1)만 고친 뒤 15회 중 7회 CI 실패가 남아 (2)를 찾았다. 둘 다 고친 뒤 30회 연속 통과.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- `src/runner/pool.js` — 결과를 `results[start + i]`에 넣어 입력 순서를 유지. `onChunk`의 `done`은 별도 카운터로 유지(기존 동작 동일).
- `src/store/report-archive.js` — 임시 파일 이름에 `reportId`를 넣어 동시 저장끼리 겹치지 않게 함.
- `test/pool.test.js`, `test/archive.test.js` — 시험 추가만 했다. 기존 시험은 바꾸지 않았다.

## 재현 테스트
- 위치: `test/pool.test.js`('결과는 완료 순서가 아니라 입력 순서로 돌려준다'), `test/archive.test.js`('같은 시각에 동시에 저장해도 임시 파일이 겹치지 않는다')
- 수정 전: 실패 (`node --test test/pool.test.js` → fail 1, `node --test test/archive.test.js` → ENOENT로 fail 1)
- 수정 후: 통과 (`npm test` → pass 64 / fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci`를 30회 반복
- 결과: `npm test` 통과(64). `npm run test:ci` 30회 모두 `# fail 0`
- 실패 항목: 없음 (수정 전 간헐 실패는 기준 커밋에서도 발생)
