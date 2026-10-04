# 밤 배치 간헐 실패 수정: runPool 결과 순서와 보고서 임시 파일 이름 충돌

## 요약
CI(`npm run test:ci`)에서 보고서가 엉뚱한 작업(고객사)에 붙던 간헐 실패 두 가지를 원인 코드에서 고쳤다. 재시도·skip·시간 제한 증가는 없고, 병렬 실행(동시 4개)은 유지한다.

## 원인
1. `runPool`이 결과를 끝난 순서로 쌓는데 `collectResults`는 index로 짝짓는다. 조회 지연으로 완료 순서가 바뀌면 `expected report-6 to belong to job-6, got job-5`로 실패한다.
2. `saveReport`의 임시 파일 이름이 시각(`stamp(now())`)뿐이라 같은 ms에 시작한 동시 저장이 같은 임시 파일을 쓴다. ENOENT 실패나 다른 고객사 내용이 보관되는 문제가 생긴다(`ci/archive.test.js`).

## 변경
- `src/runner/pool.js`: 결과를 `results[start + i]`에 index로 저장해 items 순서로 돌려준다. `onChunk`의 `done`은 카운터로 유지.
- `src/store/report-archive.js`: 임시 파일 이름에 `reportId`를 넣는다.
- `test/pool.test.js`: 순서 보존 시험 추가.
- `docs/knowledge/`: 간헐 실패 원칙, runPool 결과 순서, 임시 파일 이름 지식 추가.

## 테스트
- `ci/batch.test.js` 30회 반복: 수정 전 6회 실패 → 수정 후 0회
- `ci/archive.test.js` 30회 반복: 수정 전 20회 중 5회 실패 → 수정 후 0회
- `npm run test:ci` 10회 연속 통과 (pass 67 / fail 0), `npm test` pass 63 / fail 0
