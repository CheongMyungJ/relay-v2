# fix: 보고서 임시 파일 이름이 같은 ms의 저장끼리 겹치지 않게 한다

## 요약
CI의 `ci/archive.test.js`가 가끔 `ENOENT ... .tmp` 또는 고객사 뒤바뀜으로 실패하던 문제를 고쳤다.

## 원인
`saveReport`가 임시 파일 이름을 시각(ms)만으로 정해, 병렬 4개 저장이 같은 ms에 시작하면 같은 임시 파일을 공유했다. 먼저 rename한 쪽이 파일을 가져가면 나머지는 ENOENT가 나거나 다른 고객사 내용이 제 이름으로 옮겨졌다. 지연이 없는 로컬 시험은 겹치지 않아 통과했다.

## 변경
- src/store/report-archive.js: 임시 파일 이름에 reportId와 증가 번호를 넣어 저장마다 유일하게 했다. 병렬 4개, 재시도, 시간 제한은 그대로다.
- test/archive.test.js: 같은 ms에 동시 저장해도 덮어쓰지 않는 시험을 추가했다.
- docs/knowledge/store/report-tmp-file-name.md: 이 함정을 팀 지식으로 남겼다.

## 테스트
- `ci/archive.test.js` 25회 반복: 수정 전 10회 실패 → 수정 후 0회.
- `node --test test/archive.test.js`: pass 10, fail 0.
- `npm run test:ci` 8회: 6회 통과, 2회는 ci/batch.test.js(runPool 결과 순서)가 실패. 이번 범위 밖이며 별도 Work(w-20261004-001)에서 수정 중이다.
