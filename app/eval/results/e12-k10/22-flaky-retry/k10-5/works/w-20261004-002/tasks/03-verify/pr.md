# fix: 보고서 임시 파일 이름이 동시 저장끼리 겹치지 않게 한다

## 요약
`npm run test:ci`에서 ci/archive.test.js가 가끔 실패하던 문제를 고쳤다. `saveReport`의 임시 파일 이름에 reportId와 호출별 번호를 넣었다.

## 원인
임시 파일 이름이 시각(ms)만으로 정해져, 같은 ms에 시작한 동시 저장이 같은 임시 파일을 공유했다. 한 저장이 rename으로 파일을 옮기면 다른 저장이 `ENOENT`가 되고, 옮기기 전에 덮어쓰면 다른 고객사 내용이 제 이름으로 보관됐다.

## 변경
- `src/store/report-archive.js`: 임시 파일 이름을 `.<reportId>.<시각>.<호출별 번호>.tmp`로 한다.
- `test/archive.test.js`: 같은 시각에 동시에 저장해도 섞이지 않는 재현 테스트 추가 (수정 전 3/3 실패).
- `docs/knowledge/runner/pool-result-order.md`: 두 증상의 구분과 남은 항목을 기록.

## 테스트
- `npm test`: 63 통과
- `npm run test:ci` 18회 반복: ci/archive.test.js 매번 통과
- ci/batch.test.js의 간헐 실패(runPool 완료 순서)는 별도 Work에서 리뷰 중이라 이번 범위 밖이며 여전히 가끔 실패한다.
