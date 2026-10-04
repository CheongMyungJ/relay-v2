## 재현
- 재현 절차: `npm run test:ci`를 반복 실행 (6회 중 5회 실패)
- 결과: 재현됨
- 기대: `ci/archive.test.js` 통과, 오류 없음
- 실제: `ENOENT: 파일이 없습니다: reports/2026-09/.xxxx.tmp`(작업 실패)와 `report-N 보관본의 고객사가 다르다: initech (globex여야 함)`

## 원인
- 원인: (1) `saveReport`의 임시 파일 이름이 ms 시각뿐이라 동시 저장 두 건이 같은 이름을 쓰고, 먼저 rename한 쪽이 파일을 가져가 나중 쪽이 ENOENT. (2) `runPool`이 결과를 완료 순서로 `push`해 `collectResults`가 index로 짝지을 때 `report-N`이 다른 job의 결과에 묶임.
- 근거: src/store/report-archive.js:23 (`.${stamp(now())}.tmp`), 실패 로그에 같은 `.mutd64jn.tmp`가 job-7, job-8에서 함께 나옴. src/runner/pool.js `results.push`와 src/collect/collector.js:35 `outcomes[i]`. 두 재현 테스트가 수정 전 실패, 수정 후 통과. 수정 후 `test:ci` 15회 연속 통과(수정 전 6회 중 5회 실패). 병렬 4개일 때만 발생(동시 완료/동시 저장이 필요).
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름에 reportId와 호출마다 늘어나는 번호를 붙여 저장마다 고유하게 함 (`.` 시작, `.tmp` 끝 형식 유지)
- src/runner/pool.js — 결과를 `results[start + i]`로 입력 순서에 저장. `onChunk`의 `done`은 완료 개수 카운터로 유지
- test/pool.test.js, test/archive.test.js — 재현 테스트 추가 (기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/pool.test.js `결과는 완료 순서가 아니라 입력 순서`, test/archive.test.js `보고서 보관: 같은 ms에 동시에 저장해도 임시 파일이 겹치지 않는다` (시각을 멈추고 동시 저장해 결정적으로 재현)
- 수정 전: 실패 (`npm test`: not ok 10, not ok 31, fail 2)
- 수정 후: 통과 (`npm test`: pass 64, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` (15회 반복)
- 결과: 모두 통과 (fail 0)
- 실패 항목: 없음 (수정 전 `ci/archive.test.js` 실패는 기준 커밋에서도 실패했던 것)
