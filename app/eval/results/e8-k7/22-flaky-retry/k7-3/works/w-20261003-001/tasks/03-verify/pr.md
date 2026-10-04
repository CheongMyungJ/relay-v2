# fix: runPool 결과 순서와 보고서 임시 파일 이름 충돌로 인한 CI 간헐 실패 수정

## 요약
`ci/batch.test.js`(`expected report-6 to belong to job-6, got job-5`)와 `ci/archive.test.js`가 지연에 따라 가끔 실패하던 문제를 src에서 고쳤다. 재시도, skip, 시간 제한, 동시성(4개)은 건드리지 않았다.

## 원인
- `runPool`이 결과를 작업이 끝난 순서로 모아, `collectResults`가 index로 짝지을 때 job과 결과가 어긋났다.
- `saveReport` 임시 파일 이름이 ms 시각뿐이라 같은 ms에 시작한 동시 저장이 같은 파일을 썼다.

## 변경
- `src/runner/pool.js`: 결과를 입력 위치(`results[start + i]`)에 넣는다.
- `src/store/report-archive.js`: 임시 파일 이름에 reportId를 넣는다.
- `test/pool.test.js`, `test/archive.test.js`: 재현 시험 각 1개 추가.
- `docs/knowledge/`: 팀 규칙과 실패 유형 기록.

## 테스트
- `npm test`: 64 pass / 0 fail
- `npm run test:ci` 10회: 모두 fail 0
- `ci/batch.test.js` 20/20, `ci/archive.test.js` 20/20 통과 (수정 전 batch는 20회 중 7회 실패)
