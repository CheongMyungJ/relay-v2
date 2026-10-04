# 밤 배치 간헐 실패 수정: runPool 결과 순서와 보고서 임시 파일 이름 충돌

## 요약
CI의 `ci/batch.test.js`(`report-N`이 `job-N`이 아닌 이웃 job에 귀속)와 `ci/archive.test.js`(다른 고객사 보관본, ENOENT)의 간헐 실패를 코드에서 고쳤다. 병렬 4개는 유지하고 시험은 약화하지 않았다.

## 원인
- `runPool`이 끝나는 순서대로 결과를 쌓아 입력 순서와 달라졌는데, `collectResults`는 인덱스로 짝을 지었다.
- `saveReport`의 임시 파일 이름이 시각 꼬리표뿐이라 같은 ms에 저장하는 보고서끼리 같은 임시 파일을 썼다.

## 변경
- `src/runner/pool.js`: 결과를 `results[start + i]`에 넣어 입력 순서 보존.
- `src/store/report-archive.js`: 임시 이름을 `.<reportId>.<stamp>.tmp`로.
- `test/pool.test.js`: 순서 보존 테스트 추가.
- `docs/knowledge/`: 관련 규칙과 함정 3건.

## 테스트
- `npm test` 63 pass.
- `npm run test:ci` 20회, `ci/batch.test.js` 20회, `ci/archive.test.js` 20회 모두 통과.
