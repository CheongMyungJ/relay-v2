# fix: ci/archive.test.js 간헐 실패 — 보고서 임시 파일 이름 충돌과 runPool 결과 순서

## 요약
`npm run test:ci`에서 ci/archive.test.js가 간헐적으로 실패하던 원인 두 가지를 고쳤다. 배치 병렬 실행(동시 4개)은 그대로다.

## 원인
- `saveReport`의 임시 파일 이름이 `.${stamp(now())}.tmp`여서 같은 ms에 동시에 저장하는 보고서끼리 이름이 겹쳤다. 먼저 끝난 쪽이 rename하면 다른 쪽이 `ENOENT`로 실패했다.
- `runPool`이 완료 순서로 결과를 쌓아, 지연 jitter로 순서가 바뀌면 `collectResults`가 인덱스로 짝짓는 결과가 다른 작업의 것이 됐다(`report-6 보관본의 고객사가 다르다`).
- 로컬 `npm test`는 지연이 없어 항상 통과해 가려져 있었다.

## 변경
- src/store/report-archive.js: 임시 파일 이름에 reportId를 넣었다.
- src/runner/pool.js: 결과를 `results[start + i]`에 넣어 입력 순서로 돌려준다. onChunk의 `done`은 별도 카운터로 센다.
- test/pool.test.js, test/archive.test.js: 회귀 시험 추가. archive 시험은 시계를 고정해 수정 전에는 실패한다.
- docs/knowledge/: 임시 파일 이름과 가짜 시계 관련 지식 2건 추가.

## 테스트
- `npm test`: 64 pass / 0 fail
- `npm run test:ci` 20회 반복: 모두 통과
- `node --test ci/archive.test.js` 20회 반복: 모두 통과 (수정 전에는 20회 중 9회 실패)
- 앞 Work(w-20261003-001)와 같은 파일을 고쳤을 수 있어 머지 시 충돌 가능
