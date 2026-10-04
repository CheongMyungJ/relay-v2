# fix: 병렬 배치에서 report가 엉뚱한 job에 묶이는 간헐 실패 수정

## 요약
`ci/batch.test.js`의 `expected report-6 to belong to job-6, got job-5`와 `ci/archive.test.js`의 임시 파일 충돌 간헐 실패를 고쳤다. 병렬 4개는 유지했고 시험 우회는 없다.

## 원인
- `runPool`이 결과를 끝난 순서로 쌓는데 `collectResults`는 입력 순서(index)로 짝지어, 지연 순서가 바뀌면 기록이 엉뚱한 job에 묶였다.
- `saveReport`의 임시 파일 이름이 ms 시각뿐이라 같은 ms에 시작한 동시 저장끼리 겹쳤다.

## 변경
- src/runner/pool.js: 결과를 입력 순서 위치에 저장, 진행 알림 done은 별도 카운터
- src/store/report-archive.js: 임시 파일 이름에 reportId와 호출별 번호 추가
- 재현 테스트 추가(test/pool.test.js, test/archive.test.js), 팀 지식 docs/knowledge/batch/ 추가

## 테스트
- 기준 커밋에서 `npm run test:ci` 6회 중 5회 실패 → 수정 후 20회 연속 통과
- `npm test` pass 64 / fail 0
- 재현 테스트 2개는 수정 전 실패, 수정 후 통과
