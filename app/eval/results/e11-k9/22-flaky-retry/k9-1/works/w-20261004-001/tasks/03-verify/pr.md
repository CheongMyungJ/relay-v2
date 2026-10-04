# fix: CI 간헐 실패 — runPool 결과 순서와 saveReport 임시 파일 충돌 수정

## 요약
`npm run test:ci`에서 `ci/batch.test.js`(report가 다른 job에 붙음)와 `ci/archive.test.js`(ENOENT, 다른 고객사 보관본)가 간헐 실패하던 원인을 제품 코드에서 고쳤다. 시험은 수정하지 않았다.

## 원인
- `runPool`이 결과를 끝난 순서대로 push했는데 `collectResults`는 인덱스로 job과 짝지어, 조회 지연 jitter로 완료 순서가 바뀌면 report가 다른 job에 붙었다.
- `saveReport` 임시 파일 이름이 ms stamp뿐이라 같은 ms의 동시 저장이 같은 파일을 쓰고 rename해 실패하거나 내용이 섞였다.
- 로컬 `npm test`는 지연이 0이라 가려졌다.

## 변경
- `src/runner/pool.js`: 결과를 `results[start + i]`에 넣어 items 순서로 돌려준다.
- `src/store/report-archive.js`: 임시 파일 이름에 reportId와 호출 번호를 넣는다.
- 재현 테스트 추가: `test/pool.test.js`, `test/archive.test.js`.

## 테스트
- `npm test` 65 통과
- `npm run test:ci` 30회 연속 통과
- `node --test ci/batch.test.js` 20회 연속 통과
