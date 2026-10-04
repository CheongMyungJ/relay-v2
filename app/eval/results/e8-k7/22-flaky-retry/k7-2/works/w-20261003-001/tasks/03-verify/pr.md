# fix: 배치 결과 순서와 보관 임시 파일 이름 충돌 수정

## 요약
`npm run test:ci`가 간헐적으로 `expected report-N to belong to job-N`과 보관소 `ENOENT`로 실패하던 원인 두 가지를 고쳤다. 병렬 실행(동시 4개)은 그대로다.

## 원인
- `runPool`이 결과를 끝난 순서로 쌓는데 `collectResults`는 인덱스로 job과 짝지어, 조회 지연 순서가 바뀌면 report가 다른 job에 붙었다.
- `saveReport`의 임시 파일 이름이 ms 시각뿐이라 같은 ms에 동시 저장하면 같은 파일을 쓰고 rename해 ENOENT가 났다.

## 변경
- `src/runner/pool.js`: 결과를 items 인덱스 자리에 넣는다.
- `src/store/report-archive.js`: 임시 파일 이름에 reportId를 넣는다 (`.reportId.stamp.tmp`).
- `test/pool.test.js`, `test/archive.test.js`: 재현 테스트 추가 (기존 테스트 변경 없음).
- `docs/knowledge/`: 팀 지식 4건 추가.

## 테스트
- `npm test`: 64 통과
- `npm run test:ci` 20회 반복: 20/20 통과 (수정 전 8회 중 3회 실패)
- 정산팀 등이 임시 파일 이름 규칙에 의존하는지 확인이 필요하다.
