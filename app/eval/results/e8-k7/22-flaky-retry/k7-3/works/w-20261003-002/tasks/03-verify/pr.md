# fix: 보고서 임시 파일 이름에 reportId를 넣어 동시 저장이 겹치지 않게 한다

## 요약
`ci/archive.test.js`의 간헐 실패(`ENOENT ... .tmp`, 보관본 고객사 뒤바뀜)를 고쳤다. 동시성(4개)은 그대로 둔다.

## 원인
`saveReport`의 임시 파일 이름이 ms 시각뿐이라, 같은 ms에 시작한 동시 저장이 같은 임시 파일을 써서 rename이 ENOENT로 실패하거나 내용이 뒤바뀌었다.

## 변경
- `src/store/report-archive.js`: 임시 파일 이름을 `.<reportId>.<stamp>.tmp`로 변경
- `test/archive.test.js`: 시각을 고정하고 4개를 동시에 저장하는 재현 시험 추가
- `docs/knowledge/repro-timing-collisions-with-fixed-clock.md`: 재현 방법 기록

## 테스트
- `ci/archive.test.js` 30회 반복: 실패 0회 (수정 전 15회 중 6회 실패)
- `npm test`: 63 통과
- `npm run test:ci`: 13회 중 3회 실패, 모두 `ci/batch.test.js`(`runPool` 완료 순서 문제, 이 PR의 비목표)
