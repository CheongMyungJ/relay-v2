## 재현
- 재현 절차: 작업 디렉터리에서 `for i in $(seq 20); do node --test ci/archive.test.js 2>&1 | grep -E "^# fail|ENOENT|다르다"; done`
- 결과: 재현됨
- 기대: 20회 모두 `# fail 0`
- 실제: 20회 중 약 8회 실패. `ENOENT: 파일이 없습니다: reports/2026-09/.musc134e.tmp`, `report-1 보관본의 고객사가 다르다: globex (acme여야 함)` 등 요청의 두 메시지가 그대로 나옴

## 원인
- 원인: `saveReport`가 임시 파일 이름을 `.${stamp(now())}.tmp`로 시각(ms)만으로 만들어, 동시에 도는 작업(동시성 4)이 같은 ms에 저장을 시작하면 같은 임시 파일을 같이 쓴다. 먼저 끝난 쪽이 rename으로 임시 파일을 가져가면 다른 쪽 rename은 ENOENT가 되고, 그 사이 다른 작업의 내용이 제 이름으로 옮겨져 보관본의 고객사가 어긋난다.
- 근거: `src/store/report-archive.js:23`의 임시 이름. 실패한 임시 이름이 매번 다른 것은 시각 기반이라서다. 실패 시 보관본의 고객사는 늘 다른 작업의 것(globex↔acme 등)이다. 로컬 `npm test`는 시계를 고정하고 sleep을 대체해 저장이 겹치지 않거나 지연이 없어 통과한다. 임시 이름에 reportId를 넣자 30회 연속 실패 0. 실험: 시계 고정 + 동시 저장 시험이 수정 전 실패.
- 사람 추정 판정: 없음 (추가 의견은 관찰일 뿐 추정이 아님)
- 기각한 가설: 없음

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름에 reportId를 넣어 `.${reportId}.${stamp}.tmp`로 해 저장마다 고유하게 함. 점(.)으로 시작하고 `.tmp`로 끝나는 규칙은 유지해 `listReports`/`strayTemps`가 그대로 동작
- test/archive.test.js — 재현 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/archive.test.js 마지막 시험 '보관: 같은 시각에 동시에 저장해도 서로의 임시 파일을 건드리지 않는다'
- 수정 전: 실패 (`node --test test/archive.test.js` → pass 9, fail 1)
- 수정 후: 통과 (같은 명령 → pass 10, fail 0)

## 테스트 실행
- 명령: `npm run test:ci`; `ci/archive.test.js` 30회 연속 실행
- 결과: test:ci pass 67 / fail 0. archive CI 시험 30회 중 실패 0회
- 실패 항목: 없음
