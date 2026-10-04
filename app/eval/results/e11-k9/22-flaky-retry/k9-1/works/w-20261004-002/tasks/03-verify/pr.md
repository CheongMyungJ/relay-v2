# fix: 보고서 임시 파일 이름이 동시 저장끼리 겹치지 않게 한다

## 요약
`ci/archive.test.js`가 가끔 `ENOENT`나 고객사 불일치로 실패하던 문제를 고쳤다.

## 원인
`saveReport`가 임시 파일 이름을 밀리초 시각만으로 만들어, 같은 밀리초에 시작한 동시 저장이 같은 임시 파일을 썼다. 한쪽이 rename하면 다른 쪽은 ENOENT가 나고, 덮어쓴 쪽은 다른 고객사 내용이 남았다. 지연이 0인 `npm test`는 이를 가렸다.

## 변경
- `src/store/report-archive.js`: 임시 이름을 `.${reportId}-${stamp}-${tmpSeq}.tmp`로 고유하게 함
- `test/archive.test.js`: 같은 시각 동시 저장 재현 시험 추가
- `docs/knowledge/`: 임시 파일 이름 함정, flaky 시험 정책 기록

## 테스트
- `npm test` 통과(63/0), `node --test ci/archive.test.js` 40회 통과
- `npm run test:ci`는 비목표인 `ci/batch.test.js`의 간헐 실패로 10회 중 2회 실패(archive 관련 실패 없음)
