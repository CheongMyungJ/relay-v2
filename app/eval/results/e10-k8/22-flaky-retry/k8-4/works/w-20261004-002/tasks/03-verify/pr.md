# fix: 보관소 임시 파일 이름에 reportId를 넣어 동시 저장 충돌 방지

## 요약
`npm run test:ci`의 `ci/archive.test.js`가 가끔 실패하던 문제를 고쳤다. 병렬 실행(동시 4개)은 그대로 둔다.

## 원인
`saveReport`가 임시 파일 이름을 ms 시각만으로 만들어(`.${stamp(now())}.tmp`), 같은 ms에 시작한 동시 저장끼리 같은 임시 파일을 썼다. 한쪽이 먼저 rename하면 다른 쪽이 `ENOENT`로 실패하고, 덮어쓰기 순서에 따라 다른 고객사의 내용이 제 이름으로 옮겨지기도 했다. 지연이 없는 로컬 `npm test`는 저장이 겹치지 않아 통과했다.

## 변경
- `src/store/report-archive.js`: 임시 파일 이름을 `.${reportId}.${stamp}.tmp`로 바꿨다. 보관본 이름과 `listReports`/`strayTemps` 필터는 그대로다.
- `test/archive.test.js`: 시각을 고정하고 4개를 동시에 저장하는 재현 테스트를 추가했다. 기존 테스트는 바꾸지 않았다.

## 테스트
- `npm test`: 63개 통과.
- `node --test ci/archive.test.js`: 30회 중 30회 통과.
- `npm run test:ci` 35회 반복: 보관소 실패 0회. 전체 통과는 25회이고, 나머지 10회 실패는 모두 이 PR의 범위 밖인 `ci/batch.test.js` 순서 문제(`expected report-N to belong to job-N`)다.
