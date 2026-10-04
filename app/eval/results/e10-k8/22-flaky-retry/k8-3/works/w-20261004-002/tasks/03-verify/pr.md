# fix: ci/archive.test.js 간헐 실패 — runPool 결과 순서와 보관소 임시 파일 겹침

## 요약
`npm run test:ci`의 `ci/archive.test.js`가 가끔 `ENOENT ... .tmp`나 고객사 불일치로 실패하던 문제를 제품 코드에서 고쳤다. 병렬 실행(동시 4개)은 그대로다.

## 원인
- `saveReport`의 임시 파일 이름이 시각(ms)뿐이라, 같은 ms에 동시 저장하는 보고서끼리 같은 임시 파일을 쓰고 먼저 rename한 쪽이 파일을 가져가 ENOENT가 났다.
- `runPool`이 결과를 끝난 순서로 쌓아, 지연이 있으면 `collectResults`가 인덱스로 짝지을 때 결과가 다른 job에 붙었다.

## 변경
- `src/runner/pool.js`: 결과를 `results[start + i]`에 넣어 입력 순서를 보장
- `src/store/report-archive.js`: 임시 파일 이름에 reportId와 일련번호를 붙임
- 재현 시험 2개 추가, `docs/knowledge/runner/pool-result-order.md` 갱신

## 테스트
- `npm test` 64/64, `npm run test:ci` 68/68 통과
- `ci/archive.test.js` 20회 중 20회 통과 (수정 전 6회 중 4회 실패)
