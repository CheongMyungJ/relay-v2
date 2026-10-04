## 재현
- 재현 절차: `npm run test:ci`를 반복 실행 (6회 중 4회 실패)
- 결과: 재현됨
- 기대: `ci/archive.test.js` 통과
- 실제: `ENOENT: 파일이 없습니다: reports/2026-09/.<이름>.tmp`, `report-6 보관본의 고객사가 다르다: hooli (stark여야 함)`

## 원인
- 원인: (1) `saveReport`가 임시 파일 이름을 ms 시각만으로 만들어 같은 ms에 동시 저장하는 job끼리 같은 임시 파일을 쓰고 옮겨, 먼저 rename한 쪽이 파일을 가져가 다른 쪽은 ENOENT가 난다. (2) `runPool`이 결과를 완료 순서로 push해 지연 지터로 순서가 바뀌면 `collectResults`가 report를 다른 job에 붙인다.
- 근거: `src/store/report-archive.js` 임시 이름 `.${stamp(now())}.tmp`, `src/runner/pool.js`의 `results.push`, `src/collect/collector.js`의 인덱스 짝짓기. 수정 후 `test:ci` 20회 연속 통과(전에는 6회 중 4회 실패). 지연이 없는 `npm test`는 통과하므로 조건도 설명됨.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/runner/pool.js — 결과를 items 인덱스 자리에 넣는다.
- src/store/report-archive.js — 임시 이름에 reportId와 호출마다 늘어나는 번호(`nextId('tmp')`)를 붙인다.
- test/pool.test.js, test/archive.test.js — 시험 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/pool.test.js '결과는 완료 순서가 아니라 items 순서', test/archive.test.js '같은 시각에 동시에 저장해도…'
- 수정 전: pool 시험은 실패(`npm test`에서 not ok 31). archive 시험은 가짜 시계 때문에 수정 전에도 통과해 회귀 시험으로 약함. 실제 재현은 `ci/archive.test.js`가 맡는다.
- 수정 후: 통과 (`npm test` 64 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 20회 반복
- 결과: `npm test` 통과, `test:ci` 20회 모두 통과
- 실패 항목: 수정 뒤 실패 없음 (수정 전 실패는 기준 커밋에서도 실패)
