# fix: 보고서 임시 파일 이름 충돌과 runPool 결과 순서로 생기는 test:ci 간헐 실패 제거

## 요약
`npm run test:ci`에서 ci/archive.test.js가 간헐적으로 실패하던 원인을 코드에서 제거했다. 같은 원인 계열인 ci/batch.test.js의 간헐 실패(runPool 결과 순서)도 함께 고쳤다. 시험에 재시도, skip, 시간 제한 증가, LATENCY 축소는 넣지 않았다.

## 원인
- `saveReport`의 임시 파일 이름이 시각(ms)만이라, 같은 ms에 저장하는 보고서끼리 이름이 겹쳤다. 그래서 다른 고객사 내용이 저장되거나 rename이 ENOENT로 실패했다.
- `runPool`이 완료 순서대로 결과를 push했다. `collectResults`는 `outcomes[i]`를 `jobs[i]`와 인덱스로 짝짓기 때문에, 지연이 달라 완료 순서가 바뀌면 작업과 결과가 어긋났다.

## 변경
- src/store/report-archive.js: 임시 이름에 reportId를 넣었다.
- src/runner/pool.js: 결과를 `results[start + i]`에 넣어 입력 순서를 지키고, onChunk `done`은 별도 카운터로 센다.
- 주의: runPool 수정은 intent의 비목표(batch 시험은 이번 범위가 아니다)에 해당한다. 사람이 작업 중에 범위에 넣도록 명시적으로 허용했다.
- test/archive.test.js, test/pool.test.js: 결정적인 회귀 시험 3개를 추가했다. 기존 시험은 바꾸지 않았다.

## 테스트
- `npm test`: 65 통과, 0 실패
- `npm run test:ci` 20회 반복: 실패 0회, 회당 69 통과
- 새 archive 시험은 수정 전 코드에서 실패하는 것을 확인했다.
