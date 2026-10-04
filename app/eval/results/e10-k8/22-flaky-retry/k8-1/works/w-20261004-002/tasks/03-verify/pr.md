# fix: 보고서 임시 파일 이름이 같은 밀리초 저장끼리 겹치지 않게 한다

## 요약
`npm run test:ci`에서 `ci/archive.test.js`가 간헐로 실패하던 문제를 고쳤다. 동시에 저장하는 보고서의 임시 파일 이름이 겹치는 것이 원인이었다.

## 원인
`saveReport`가 임시 파일 이름을 밀리초 시각(`.<시각>.tmp`)만으로 만들었다. 배치가 작업을 동시에 돌려 같은 밀리초에 시작한 두 저장이 같은 임시 파일을 썼고, 먼저 끝난 쪽이 `rename`하면 다른 쪽은 `ENOENT`가 났다. 남은 내용이 다른 고객사 것이면 고객사가 뒤바뀐 보관본이 생겼다. 지연이 없는 로컬 `npm test`는 저장이 겹치지 않아 통과했다.

## 변경
- `src/store/report-archive.js`: 임시 이름을 `.<시각>-<번호>.tmp`로 바꿨다. 번호는 호출마다 늘어난다.
- `test/archive.test.js`: 시각이 멈춘 상태에서 동시에 저장해도 임시 파일이 겹치지 않는 시험을 추가했다. 수정 전에는 실패한다.
- `docs/knowledge/store/report-archive-tmp-name.md`: 이 함정을 팀 지식으로 남겼다.

## 테스트
- `npm test`: 63/63 통과.
- `node --test ci/archive.test.js` 10회: 실패 0.
- `npm run test:ci` 6회: `ci/archive.test.js` 실패 0. 1회는 범위 밖인 `ci/batch.test.js`(runPool 결과 순서)가 실패했다.
- 번호는 프로세스 안에서만 유일하다. 여러 프로세스가 같은 폴더에 저장하는 경우는 다루지 않았다.
