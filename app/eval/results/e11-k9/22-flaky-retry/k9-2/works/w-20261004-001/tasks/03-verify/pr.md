# fix: 밤 배치 보고서가 다른 작업·고객사에 붙던 문제 수정

## 요약
지연이 있는 CI(`npm run test:ci`)에서 간헐적으로 실패하던 두 가지 원인을 고쳤다. 보고서가 엉뚱한 작업(jobId)에 붙는 문제와, 보관 시 다른 고객사 내용으로 덮이는 문제다.

## 원인
- `runPool`이 결과를 완료 순서대로 쌓았는데 `collectResults`는 인덱스로 작업과 짝지어, 조회 지연 편차로 완료 순서가 바뀌면 기록이 다른 작업에 붙었다.
- `saveReport`의 임시 파일 이름이 ms 단위 시각뿐이라, 같은 ms에 저장하는 보고서끼리 이름이 겹쳐 다른 고객사 내용으로 덮이거나 rename이 실패했다.

## 변경
- `src/runner/pool.js`: 결과를 입력 순서 자리에 넣고, 진행 알림 `done`은 별도 카운터로 센다.
- `src/store/report-archive.js`: 임시 파일 이름에 reportId를 넣는다.
- `test/pool-order.test.js`: 완료 순서와 입력 순서가 다를 때의 재현 시험 추가.
- `docs/knowledge/`: 간헐 실패 처리 규칙, runPool 순서, 임시 파일 이름 관련 지식 추가.
- 시험의 재시도, skip, 시간 제한, 지연 설정은 건드리지 않았다.

## 테스트
- `npm test` 63 통과, `npm run test:ci` 67 통과 (30회 반복 모두 통과)
- `node --test ci/batch.test.js` 30회 반복 모두 통과 (수정 전 20회 중 3회 실패)
