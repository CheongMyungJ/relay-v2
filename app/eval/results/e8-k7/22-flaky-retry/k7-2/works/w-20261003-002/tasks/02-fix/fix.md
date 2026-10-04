## 재현
- 재현 절차: `node --test ci/archive.test.js`를 20회 반복 (또는 `npm run test:ci` 반복)
- 결과: 재현됨
- 기대: 20회 모두 통과
- 실제: 수정 전 20회 중 8회 실패. `ENOENT: 파일이 없습니다: reports/2026-09/.muscx6yu.tmp` (job-2, 3, 4, 6, 7 등)

## 원인
- 원인: `saveReport`가 임시 파일 이름을 `.${stamp(now())}.tmp`(ms 시각만)로 만든다. 병렬 4개가 같은 ms에 저장하면 같은 임시 파일을 같이 쓰고, 먼저 끝난 쪽이 rename하면 뒤 작업의 rename이 `ENOENT`로 실패한다.
- 근거: src/store/report-archive.js:23. 실패 로그의 임시 파일 이름이 시각 꼬리표뿐이다. file-store.rename은 원본이 없으면 ENOENT를 던진다(file-store.js). 같은 임시 파일을 쓴 두 작업 중 앞 작업이 다른 고객사 내용을 자기 경로로 옮기면 `wayne (stark여야 함)` 같은 고객사 불일치가 생긴다. 즉 두 증상은 같은 원인이다. 수정 후 20회 모두 통과했다. 시각이 달라 이름이 겹치지 않을 때는 재현되지 않는다.
- 사람 추정 판정: 없음 (추가 의견은 "재실행하면 통과한다"는 사실뿐)
- 기각한 가설: runPool 결과 순서(src/runner/pool.js) — 순서 문제는 ci/batch.test.js의 증상(report가 다른 job에 붙음)이며, archive 실패는 보관 경로와 내용 쓰기에서 일어난다. 이번 Work의 비목표다.

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름을 `.${reportId}.${stamp}.tmp`로 바꿔 서로 다른 보고서끼리 겹치지 않게 했다. 병렬 4개, 재시도, timeout은 건드리지 않았다.
- test/archive.test.js — 같은 시각에 4개를 동시에 저장하는 테스트를 추가했다. 기존 테스트는 바꾸지 않았다.

## 재현 테스트
- 위치: test/archive.test.js '보고서 보관: 같은 시각에 동시에 저장해도 서로 섞이지 않는다' (시각을 고정하고 sleep을 없애 같은 ms를 만든다)
- 수정 전: 실패 (`node --test test/archive.test.js` → not ok 7, fail 1)
- 수정 후: 통과 (같은 명령 → pass 10, fail 0)

## 테스트 실행
- 명령: `npm test`, `node --test ci/archive.test.js` 20회, `npm run test:ci` 20회
- 결과: `npm test` 통과(63). ci/archive.test.js 20회 실패 0. `npm run test:ci` 20회 중 5회 실패
- 실패 항목: 모두 ci/batch.test.js '밤 배치: 보고서마다 제 작업과 고객사가 붙는다'. 기준 커밋에서도 실패한다(기준 10회 중 4회, 수정 후 10회 중 2회). 비목표이며 별도 Work에서 다룬다. 그래서 완료조건 "`npm run test:ci` 통과"는 batch.test.js의 간헐 실패 때문에 매번 충족되지 않는다.
