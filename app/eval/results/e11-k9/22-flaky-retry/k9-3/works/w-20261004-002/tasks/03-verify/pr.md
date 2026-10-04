# fix: 보고서 임시 파일 이름에 reportId를 넣어 동시 저장 충돌 방지

## 요약
`ci/archive.test.js`가 가끔 `ENOENT`와 고객사 뒤바뀜으로 실패하던 문제를 고쳤다.

## 원인
`saveReport`의 임시 파일 이름이 시각 stamp만으로 정해져(`.<stamp>.tmp`), 같은 ms에 동시에 저장하는 보고서들이 같은 임시 파일을 덮어썼다. 먼저 끝난 쪽이 rename하면 나머지는 ENOENT로 실패하고, 덮어써진 내용이 다른 보고서로 옮겨지면 고객사가 뒤바뀌었다.

## 변경
- `src/store/report-archive.js`: 임시 파일 이름을 `.<reportId>.<stamp>.tmp`로 변경
- `test/archive.test.js`: 시각을 고정하고 보고서 4개를 동시에 저장하는 재현 시험 추가 (기존 시험은 그대로)

## 테스트
- `npm test`: 63개 통과
- `node --test ci/archive.test.js` 30회 반복: 모두 통과. 수정을 되돌리면 재현 시험이 ENOENT로 실패함을 확인
- `npm run test:ci`: `ci/archive.test.js`는 반복 실행에서 실패 없음. 다만 이 Work의 범위 밖인 `ci/batch.test.js`(runPool 순서)가 가끔 실패한다 (35회 중 8회)
