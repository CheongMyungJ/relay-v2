# 보고서 임시 파일 이름 충돌로 ci/archive.test.js가 간헐 실패하는 문제 수정

## 요약
`npm run test:ci`에서 `ci/archive.test.js`가 간헐적으로 `ENOENT`나 고객사 불일치(wayne/stark)로 실패하던 문제를 고쳤다.

## 원인
`saveReport`가 임시 파일 이름을 현재 시각(ms) 꼬리표만으로 만들었다. 같은 기간 폴더에서 동시 4개 저장이 같은 ms에 시작하면 같은 임시 이름을 써서, 먼저 끝난 쪽이 옮긴 뒤 나머지는 ENOENT가 나거나 남의 내용을 제 이름으로 옮겼다. 지연이 없는 `npm test`에서는 드러나지 않는다.

## 변경
- `src/store/report-archive.js`: 임시 파일 이름을 `.<reportId>.<시각>-<호출 순번>.tmp`로 바꿨다. 같은 reportId를 같은 ms에 저장해도 겹치지 않는다.
- `test/archive.test.js`: 같은 시각 동시 저장 재현 시험 2건 추가(서로 다른 reportId, 같은 reportId).
- `docs/knowledge/runner/concurrency-order-pitfalls.md`: 팀 지식 갱신.
- 배치 병렬 실행(동시 4개)은 그대로다.

## 테스트
- `npm test`: 64/64 통과
- `node --test ci/archive.test.js` 20회: 통과 20, 실패 0
- `npm run test:ci` 10회: 통과 7, 실패 3. 실패는 모두 `ci/batch.test.js`(순서 문제)이며 기준 커밋에서도 실패한다. 별도 Work에서 수정·리뷰 중이라 이 PR 범위가 아니다.
