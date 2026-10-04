# fix: 보고서 임시 파일 이름에 reportId를 넣어 동시 저장 시 겹치지 않게 함

## 요약
`npm run test:ci`의 ci/archive.test.js가 간헐적으로 실패하던 원인(임시 파일 이름 충돌)을 제거했다.

## 원인
`saveReport`가 임시 파일 이름을 시각(ms)만으로 만들어, 같은 ms에 저장하는 보고서끼리 같은 임시 파일을 쓰고 rename했다. 그 결과 `ENOENT ... .tmp` 또는 다른 고객사 내용이 저장되는 실패가 났다.

## 변경
- src/store/report-archive.js: 임시 이름을 `.<reportId>.<stamp>.tmp`로 변경
- test/archive.test.js: 같은 ms 동시 저장 시험 추가 (기존 시험 변경 없음)

## 테스트
- `npm test` 통과 (63개)
- `npm run test:ci` 20회: archive 시험 실패 0회. 단 ci/batch.test.js가 4회 실패(runPool 결과 순서 문제, 이 PR 범위 밖)
- 새 시험은 수정 전 코드에서 실패함을 확인
