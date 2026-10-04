# fix: 병렬 보관 시 임시 파일 이름 충돌과 결과 순서 어긋남 수정

## 요약
`npm run test:ci`에서 `ci/archive.test.js`가 간헐적으로 실패하던 문제를 고쳤다. 배치 병렬 4개는 유지하고, 재시도/skip/시간 제한 늘리기는 쓰지 않았다.

## 원인
- `saveReport`의 임시 파일 이름이 ms 시각뿐이라 동시 저장 두 건이 같은 이름을 써서 `ENOENT`가 났다.
- `runPool`이 결과를 완료 순서로 쌓아, `collectResults`가 index로 짝지을 때 `report-N`이 다른 고객사 결과에 묶였다.

## 변경
- `src/store/report-archive.js`: 임시 이름에 reportId와 호출마다 늘어나는 번호를 붙임(`.` 시작, `.tmp` 끝 유지).
- `src/runner/pool.js`: 결과를 입력 순서(`results[start + i]`)로 저장. `onChunk`의 `done`은 완료 개수 카운터로 유지.
- `test/archive.test.js`, `test/pool.test.js`: 재현 테스트 추가(기존 테스트 변경 없음).

## 테스트
- `npm test`: 64개 통과.
- `npm run test:ci`: 10회 반복 모두 통과(68개). 수정 전에는 6회 중 2~5회 실패.
- 남은 위험: 번호는 프로세스 내 카운터라 여러 프로세스가 같은 보관소에 동시에 쓰는 경우는 다루지 않는다.
