# fix: 밤 배치 보관 시험(ci/archive.test.js)의 간헐 실패 수정

## 요약
`npm run test:ci`에서 간헐적으로 나던 `ENOENT` 임시 파일 오류와 "보관본의 고객사가 다르다" 오류를 고쳤다. 동시 실행 수 4는 그대로다.

## 원인
- `saveReport`가 임시 파일 이름을 ms 시각만으로 만들어, 같은 ms에 동시 저장하면 같은 임시 파일을 쓰고 옮겨 한쪽이 ENOENT로 실패했다.
- `runPool`이 결과를 완료 순서로 쌓아, 지연 지터로 순서가 바뀌면 `collectResults`가 보고서를 다른 job에 붙였다.

## 변경
- `src/runner/pool.js`: 결과를 items 인덱스 자리에 둔다.
- `src/store/report-archive.js`: 임시 이름에 reportId와 호출마다 늘어나는 번호를 붙인다.
- 시험 추가(`test/pool.test.js`, `test/archive.test.js`), 지식 `docs/knowledge/batch/pool-order-and-tmp-names.md` 갱신.

## 테스트
- `npm test` 64 통과
- `npm run test:ci` 68 통과, 20회 반복 모두 통과(수정 전 6회 중 4회 실패)
