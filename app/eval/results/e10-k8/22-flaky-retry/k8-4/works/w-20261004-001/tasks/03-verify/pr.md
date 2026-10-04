# 배치 결과 순서 뒤바뀜과 보관소 임시 파일 충돌로 인한 간헐 실패 수정

## 요약
`npm run test:ci`가 가끔 `expected report-N to belong to job-N`로 실패하던 문제를 고쳤다. 병렬 4개는 유지한다.

## 원인
- `runPool`이 결과를 끝난 순서대로 push해, 지연이 다르면 인덱스로 짝짓는 `collectResults`에서 job과 결과가 어긋났다.
- `saveReport`의 임시 파일 이름이 시각 꼬리표뿐이라, 같은 ms에 시작한 동시 저장이 같은 임시 파일을 써 보관본이 섞이거나 빠졌다.

## 변경
- `src/runner/pool.js`: 결과를 items 인덱스 위치에 저장. 진행 알림 `done`은 별도 카운터.
- `src/store/report-archive.js`: 임시 파일 이름에 reportId 추가.
- 재현 테스트를 `test/pool.test.js`, `test/archive.test.js`에 추가.
- `docs/knowledge/`에 팀 지식 추가.

## 테스트
- `npm test`: 64개 통과
- `npm run test:ci` 20번 반복: 20번 통과 (수정 전 6번 중 3번 실패)
