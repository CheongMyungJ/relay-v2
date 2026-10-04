## 재현
- 재현 절차: `for i in $(seq 25); do node --test ci/archive.test.js 2>&1 | grep "^# fail"; done | sort | uniq -c` (전체는 `npm run test:ci` 반복)
- 결과: 재현됨
- 기대: 25번 모두 실패 0
- 실제: 수정 전 25번 중 10번 실패 (fail 1: 2번, fail 2: 8번). `ENOENT: ... reports/2026-09/.xxxx.tmp`, `report-4 보관본의 고객사가 다르다: initech (umbrella여야 함)`

## 원인
- 원인: `saveReport`(src/store/report-archive.js)의 임시 파일 이름이 `.${stamp(now())}.tmp`로 시각(ms)만 쓴다. 병렬 4개 작업이 같은 ms에 저장을 시작하면 같은 임시 파일을 같이 쓰고, 먼저 rename한 쪽이 파일을 가져가 나머지는 ENOENT, 또는 다른 고객사 내용이 제 이름으로 옮겨져 고객사가 뒤바뀐다.
- 근거: 로그의 임시 파일 이름이 `.시각.tmp` 형태. 시각을 멈춘 채 동시 저장하는 시험이 수정 전 ENOENT로 실패하고 수정 후 통과. 수정 전/후 ci/archive.test.js 25회 반복: 10회 실패 → 0회 실패. 지연이 없는 로컬 시험은 저장이 겹치지 않아 통과.
- 사람 추정 판정: 없음
- 기각한 가설: runPool 결과 순서(팀 지식 run-pool-result-order.md) — archive 증상은 보관소 경로와 임시 파일에서 나오고 collectResults의 짝짓기와 무관. 그 문제는 ci/batch.test.js에서 따로 드러남(비목표).

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름에 reportId와 프로세스 내 증가 번호(`nextId('tmp')`)를 넣어 저장마다 유일하게 함. 병렬 4개, 재시도, 시간 제한은 건드리지 않음.
- test/archive.test.js — 같은 ms에 동시 저장해도 덮어쓰지 않는 시험 추가 (기존 시험 변경 없음)

## 재현 테스트
- 위치: test/archive.test.js '보고서 보관: 같은 시각에 동시에 저장해도 서로 덮어쓰지 않는다'
- 수정 전: 실패 (`node --test test/archive.test.js` → fail 1, ENOENT ...tmp)
- 수정 후: 통과 (같은 명령 → pass 10, fail 0)

## 테스트 실행
- 명령: `npm run test:ci` (15회 반복)
- 결과: 13회 통과, 2회 실패. ci/archive.test.js는 단독 25회 반복 모두 통과.
- 실패 항목: 실패 2회는 ci/batch.test.js '보고서마다 제 작업과 고객사가 붙는다'(runPool 결과 순서). 이번 수정과 무관하며 기준 커밋에서도 같은 원인으로 실패 가능. 이번 intent의 비목표이고 앞 Work(w-20261004-001)에서 수정 중.
