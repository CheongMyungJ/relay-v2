# fix: 보고서 저장 임시 파일 이름이 같은 시각의 저장끼리 겹치지 않게 한다

## 요약
CI `ci/archive.test.js`가 가끔 실패하던 문제를 고친다. 동시에 도는 보고서 저장이 같은 임시 파일을 같이 쓰던 것이 원인이다.

## 원인
`saveReport`가 임시 파일 이름을 시각(ms)만으로 만들어, 같은 ms에 시작한 저장끼리 같은 임시 파일을 썼다. 먼저 끝난 쪽이 rename하면 다른 쪽은 `ENOENT`로 실패하고, 그 사이 다른 고객사 내용이 제 이름으로 옮겨져 보관본의 고객사가 어긋났다. 로컬 `npm test`는 시계를 고정하고 지연이 없어 가려졌다.

## 변경
- `src/store/report-archive.js`: 임시 이름을 `.${reportId}.${stamp}.tmp`로 해 저장마다 고유하게 함
- `test/archive.test.js`: 시각이 멈춘 채 동시 저장하는 재현 테스트 추가

## 테스트
- `node --test test/archive.test.js`: pass 10 / fail 0 (수정 전 코드에서는 실패)
- `ci/archive.test.js` 20회 연속 실행: 모두 통과
- `npm run test:ci`: 대부분 통과(pass 67). 다만 범위 밖인 `ci/batch.test.js`의 간헐 실패가 9회 중 2회 나옴
