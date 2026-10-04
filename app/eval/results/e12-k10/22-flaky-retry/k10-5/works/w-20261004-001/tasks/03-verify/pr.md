# fix: CI 간헐 실패(report-N/job-N 불일치)의 원인인 결과 순서와 임시 파일 이름 겹침을 고친다

## 요약
`ci/batch.test.js`가 가끔 `expected report-6 to belong to job-6, got job-5`로 실패하던 문제를 고쳤다. 시험은 건드리지 않았다.

## 원인
1. `runPool`이 결과를 완료 순서로 모으는데 `collectResults`는 인덱스로 job과 짝지어, 지연 때문에 순서가 바뀌면 report가 다른 job에 붙었다.
2. `saveReport`의 임시 파일 이름이 시각(ms)만 써서 같은 ms에 동시 저장하면 겹쳤다(덮어쓰기, ENOENT).

## 변경
- `src/runner/pool.js`: 결과를 입력 위치(`results[start + i]`)에 저장
- `src/store/report-archive.js`: 임시 이름에 reportId와 호출별 번호 추가
- 시험 추가: `test/pool.test.js`, `test/archive.test.js`
- `docs/knowledge/`: 간헐 실패 대응 규칙과 이번 함정 기록

## 테스트
- `npm test`: 65 통과
- `npm run test:ci` 20회 반복, `ci/batch.test.js` 20회 반복: 모두 실패 0 (수정 전 6회 중 4회 실패)
