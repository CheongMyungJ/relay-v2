## 재현
- 재현 절차: `npm run test:ci`를 여러 번 실행 (또는 `node --test ci/archive.test.js`)
- 결과: 재현됨 (수정 전 6회 중 4회 실패)
- 기대: 보고서 8건이 모두 보관되고, 보관본마다 제 고객사와 합계가 맞고, 임시 파일이 남지 않는다
- 실제: `ENOENT: 파일이 없습니다: reports/2026-09/.mute2utd.tmp`, 가끔 `report-6 보관본의 고객사가 다르다: hooli (stark여야 함)`

## 원인
- 원인: 원인이 둘이다. (1) `saveReport`의 임시 파일 이름이 `.${stamp(now())}.tmp`로 시각(ms)뿐이라, 같은 ms에 동시에 저장하는 보고서끼리 같은 임시 파일을 쓰고 먼저 rename한 쪽이 파일을 가져가 나중 쪽이 ENOENT가 나며, 덮어쓴 내용이 다른 보고서에 들어가기도 한다. (2) `runPool`이 결과를 끝난 순서로 `push`해, 지연이 있으면 `collectResults`가 인덱스로 짝지을 때 결과가 다른 job에 붙는다(고객사 불일치).
- 근거: src/store/report-archive.js:23 (수정 전), src/runner/pool.js:12-21 (수정 전), src/collect/collector.js의 `outcomes[i]` 짝짓기. 수정 전 test:ci를 6회 돌려 두 증상이 모두 나왔고, 두 수정 뒤 20회 모두 통과. 로컬 `npm test`는 지연이 없어 통과.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 입력 순서를 보장. `onChunk`의 `done`은 별도 카운터로 유지(병렬 4개와 동시성은 그대로)
- src/store/report-archive.js — 임시 파일 이름에 reportId와 일련번호(`nextId('tmp')`)를 붙여 겹치지 않게 함
- test/pool.test.js, test/store.test.js — 재현 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/pool.test.js '결과는 끝난 순서가 아니라 입력 순서다', test/store.test.js '같은 ms에 동시에 저장해도 임시 파일이 겹치지 않는다'
- 수정 전: 실패 (`git stash`로 src만 되돌리고 `npm test`: 62 통과, 2 실패 — 위 두 시험)
- 수정 후: 통과 (`npm test`: 64 통과, 0 실패)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci`, `node --test ci/archive.test.js` 20회 반복
- 결과: npm test 64/64 통과, test:ci 68/68 통과, ci/archive.test.js 20회 중 20회 통과
- 실패 항목: 없음
