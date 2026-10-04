# fix: 보고서 임시 파일 이름에 reportId를 넣어 동시 저장끼리 겹치지 않게 한다

## 요약
`npm run test:ci`에서 `ci/archive.test.js`가 가끔 실패하던 문제를 고쳤다. 실패 증상은 `ENOENT: ... .tmp`와 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`이었다.

## 원인
`saveReport`가 임시 파일 이름을 `.${stamp(now())}.tmp`로만 만들어, 같은 ms에 시작한 동시 저장(동시 4개)이 같은 임시 파일을 썼다. 한쪽이 rename하면 다른 쪽은 ENOENT로 실패하고, 겹쳐 쓰면 다른 고객사 내용이 보관본에 들어갔다. 로컬 `npm test`는 지연이 없어 저장이 겹치지 않아 늘 통과했다.

## 변경
- `src/store/report-archive.js`: 임시 파일 이름을 `.${stamp(now())}-${reportId}.tmp`로 바꿨다. 접두 `.`와 접미 `.tmp`는 `listReports`/`strayTemps`가 쓰므로 유지했다.
- `test/archive.test.js`: 시각을 고정하고 4개를 동시에 저장하는 재현 시험을 추가했다. 기존 시험, 병렬 실행, `LATENCY`는 바꾸지 않았다.

## 테스트
- `npm run test:ci`: 67개 통과
- `node --test ci/archive.test.js` 20회 반복: 모두 통과 (수정 전 20회 중 11회 실패)
