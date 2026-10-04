# fix: 보관 임시 파일 이름에 reportId를 넣어 ci/archive.test.js 간헐 실패 해결

## 요약
밤 배치 뒤 보관 단계에서 간헐적으로 나던 `ENOENT ... .tmp`와 `보관본의 고객사가 다르다` 실패를 고친다. 두 증상의 원인은 같다.

## 원인
`saveReport`가 임시 파일 이름을 `.${stamp(now())}.tmp`(ms 시각만)로 만들었다. 병렬 4개가 같은 ms에 저장하면 같은 임시 파일을 같이 쓰고, 먼저 끝난 쪽이 rename하면 뒤 작업은 `ENOENT`가 된다. 앞 작업이 다른 고객사 내용을 옮기면 고객사 불일치가 생긴다.

## 변경
- `src/store/report-archive.js`: 임시 파일 이름을 `.${reportId}.${stamp}.tmp`로 바꿨다. 병렬 동시 4개, 재시도, timeout은 그대로다.
- `test/archive.test.js`: 시각을 고정해 4개를 동시에 저장하는 재현 테스트를 추가했다.
- `docs/knowledge/`: 충돌 재현에 시계 고정이 필요하다는 지식을 추가했다.

## 테스트
- `npm test` 63개 통과
- `node --test ci/archive.test.js` 수정 전 40회 중 10회 실패(ENOENT 8, 고객사 불일치 2), 수정 후 80회 실패 0
- `npm run test:ci` 20회 중 5회 실패. 모두 ci/batch.test.js(runPool 결과 순서, 별도 Work)이며 이 변경과 무관하다
