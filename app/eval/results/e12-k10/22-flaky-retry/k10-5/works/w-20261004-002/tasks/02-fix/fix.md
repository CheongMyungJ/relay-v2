## 재현
- 재현 절차: 작업 디렉터리에서 `for i in 1 2 3 4 5 6; do npm run test:ci 2>&1 | grep -E "^# fail|ENOENT|고객사가"; done`
- 결과: 재현됨 (6번 중 4번 실패)
- 기대: ci/archive.test.js 통과
- 실제: `ENOENT: 파일이 없습니다: reports/2026-09/.mutvomzf.tmp`, `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`

## 원인
- 원인: `saveReport`의 임시 파일 이름이 시각(ms)만으로 정해져(`.${stamp(now())}.tmp`) 같은 ms에 시작한 동시 저장(동시 실행 4개)이 같은 임시 파일을 공유한다. 한 저장이 rename으로 임시 파일을 옮겨 가면 다른 저장의 rename이 ENOENT가 되고, 옮기기 전에 다른 저장이 덮어쓰면 다른 고객사 내용이 제 이름으로 보관된다.
- 근거: src/store/report-archive.js:23-26. 증상 두 가지가 같은 임시 파일 이름(`.mutvomzf.tmp`)에서 나온다. 같은 시각 고정 + 큰 이름 바꾸기 지연으로 만든 재현 테스트가 수정 전 3/3 실패, 이름에 reportId와 호출별 번호를 넣은 뒤 통과. 수정 후 `test:ci` 25회에서 ENOENT와 "고객사가 다르다"는 0회. 간헐인 이유는 같은 ms에 겹쳐 시작해야 하고 지연에 jitter가 있기 때문이다. 로컬 `npm test`에는 지연이 없어 겹치지 않는다.
- 사람 추정 판정: 없음
- 기각한 가설: runPool 결과 순서(팀 지식의 유사 증상) — 이것은 ci/batch.test.js 실패(`expected report-N to belong to job-N`)의 원인이고 보관본 내용에는 영향이 없다. archive 시험의 두 증상은 임시 파일 겹침만으로 설명된다.

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름에 reportId와 호출별 번호(모듈 카운터)를 넣어 동시 저장끼리 겹치지 않게 했다.
- test/archive.test.js — 재현 테스트 추가 (기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/archive.test.js `보고서 보관: 같은 시각에 동시에 저장해도 서로 섞이지 않는다`
- 수정 전: 실패 (`node --test test/archive.test.js` 3회 모두 `ENOENT ... .muovznk0.tmp`, fail 1)
- 수정 후: 통과 (같은 명령 3회 모두 pass 10, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 25회 반복
- 결과: `npm test` pass 63 fail 0. `test:ci`는 ci/archive.test.js가 25회 모두 통과. 25회 중 10회 ci/batch.test.js의 `밤 배치: 보고서마다 제 작업과 고객사가 붙는다`가 실패.
- 실패 항목: ci/batch.test.js — 기준 커밋에서도 실패 (runPool이 완료 순서로 결과를 모음, 범위 밖이라 고치지 않음)
