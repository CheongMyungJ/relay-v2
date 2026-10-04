## 재현
- 재현 절차: 작업 디렉터리에서 `npm run test:ci`를 8회 반복 실행
- 결과: 재현됨
- 기대: ci/archive.test.js가 매번 통과
- 실제: 8회 중 6회 실패. `ENOENT: 파일이 없습니다: reports/2026-09/.mutkt45f.tmp`, `report-8 보관본의 고객사가 다르다: wayne (wonka여야 함)`

## 원인
- 원인: `saveReport`가 임시 파일 이름을 시각(ms) 꼬리표만으로 만든다. 지연이 있는 시험에서 여러 보고서가 같은 ms에 저장되면 같은 임시 파일을 같이 쓰고 rename한다. 한쪽이 먼저 rename하면 다른 쪽은 ENOENT가 나고, 덮어쓰기가 섞이면 다른 고객사 내용이 제 이름으로 옮겨진다.
- 근거: src/store/report-archive.js:25 (`.${stamp(now())}.tmp`). 로그의 두 작업(job-7, job-8)이 같은 `.mutkt45f.tmp`를 가리킴. `npm test`는 지연이 없고 차례로 저장해 겹치지 않아 통과. 수정(임시 이름에 reportId 추가) 뒤 test:ci 20회에서 archive 시험 실패 0회 (수정 전 8회 중 6회).
- 사람 추정 판정: 없음 (추가 의견은 현상 설명뿐)
- 기각한 가설: runPool 결과 순서(팀 지식) — archive 실패 증상은 임시 이름 충돌로 모두 설명되고, 고친 뒤 archive가 안 실패하므로 이번 원인 아님. pool.js는 건드리지 않음.

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름을 `.<reportId>.<stamp>.tmp`로 바꿔 보고서마다 다르게 함. `listReports`는 `.`로 시작하는 파일을 이미 걸러 영향 없음.
- test/archive.test.js — 같은 ms에 동시 저장하는 시험 추가 (기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/archive.test.js '보고서 보관: 같은 시각에 동시에 저장해도 서로 덮어쓰지 않는다' (sleep을 즉시 반환시켜 시계를 멈춤: 결정적)
- 수정 전: 실패 (`npm test` → `not ok 7`, pass 62 / fail 1)
- 수정 후: 통과 (`npm test` → pass 63 / fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 20회 반복
- 결과: `npm test` 통과. test:ci 20회 중 8회 실패했으나 모두 ci/batch.test.js의 '밤 배치: 보고서마다 제 작업과 고객사가 붙는다'이고 ci/archive.test.js 실패는 0회.
- 실패 항목: ci/batch.test.js 실패는 이번 수정과 무관하며 비목표(따로 고쳐 리뷰 중). 기준 커밋에서 batch를 따로 돌려 확인하지는 않았고, 수정이 archive 저장 경로만 바꾸므로 이번 수정 뒤 생긴 실패로 보지 않음. 기준 커밋 실패 여부는 확인 안 함.
