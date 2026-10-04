# fix: 보고서 임시 파일 이름에 reportId를 넣어 동시 저장 때 겹치지 않게 한다

## 요약
CI의 `ci/archive.test.js`가 가끔 `ENOENT ... .tmp`나 다른 고객사 보관본으로 실패하던 문제를 고쳤다. 시험이 아니라 `saveReport`의 임시 파일 이름을 고쳤다.

## 원인
`saveReport`의 임시 파일 이름이 시각(`stamp(now())`)만 써서, 같은 밀리초에 동시에 저장하는 서로 다른 보고서가 같은 임시 파일을 공유했다. 한쪽이 rename하면 다른 쪽은 ENOENT가 나고, 덮어쓴 내용이 옮겨지면 다른 고객사 보관본이 됐다. 로컬 `npm test`는 지연이 없어 겹치지 않았다.

## 변경
- `src/store/report-archive.js`: 임시 파일 이름을 `.<reportId>-<stamp>.tmp`로 변경
- `test/archive-concurrent.test.js`: 시계를 고정하고 4개 보고서를 동시에 저장하는 재현 시험 추가 (수정 전 실패). 기존 시험은 바꾸지 않았다.

## 테스트
- `npm run test:ci`: 67개 통과
- `node --test ci/archive.test.js` 20회 연속 실행: 실패 0회 (수정 전 10회 중 6회 실패)
- 남은 위험: 같은 reportId를 같은 밀리초에 동시에 저장하면 여전히 겹칠 수 있으나 현재 호출 경로에는 없다.
