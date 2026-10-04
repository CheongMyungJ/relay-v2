## 재현
- 재현 절차: `npm run test:ci`를 6회 반복 (`for i in 1..6; do npm run test:ci; done`)
- 결과: 재현됨 (기준 커밋에서 6회 중 5회 실패, 매번 2건)
- 기대: `report-N`이 `job-N`에 묶이고 보관본의 고객사가 맞다
- 실제: `expected report-6 to belong to job-6, got job-5` (ci/batch.test.js). 같은 실행에서 ci/archive.test.js도 `ENOENT ... .tmp`, `report-6 보관본의 고객사가 다르다: hooli (stark여야 함)`로 실패

## 원인
- 원인 1: `runPool`이 결과를 끝난 순서대로 `push`하는데 `collectResults`는 작업 목록 순서(index)로 짝짓는다. 조회 지연이 달라 완료 순서가 바뀌면 기록이 엉뚱한 job에 묶인다.
- 원인 2: `saveReport`의 임시 파일 이름이 `stamp(now())`(ms 단위)뿐이라, 같은 ms에 시작한 동시 저장끼리 같은 임시 파일을 쓴다. 한쪽 rename이 끝나면 다른 쪽은 ENOENT가 나거나 다른 고객사 내용이 제 이름으로 옮겨진다. 동시 4개에서만 생기고 순차에서는 안 생기는 이유다.
- 근거: src/runner/pool.js(`results.push`), src/collect/collector.js(`jobs.map((job, i) => toRecord(job, outcomes[i]))`), src/store/report-archive.js:23. 실험: 풀만 고친 뒤에도 20회 중 11회 실패했고 남은 실패는 모두 archive.test.js였다. 두 곳을 모두 고친 뒤 30회 연속 통과.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 입력 순서로 저장. 진행 알림의 done은 별도 카운터로 계산
- src/store/report-archive.js — 임시 파일 이름에 reportId와 호출마다 늘어나는 번호를 붙여 겹치지 않게 함
- test/pool.test.js, test/archive.test.js — 재현 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/pool.test.js `결과는 끝난 순서가 아니라 입력 순서로 돌려준다`, test/archive.test.js `같은 ms에 시작한 저장끼리 임시 파일 이름이 겹치지 않는다`
- 수정 전: 실패 (`node --test test/pool.test.js` → fail 1, `node --test test/archive.test.js` → fail 1)
- 수정 후: 통과 (같은 명령 → fail 0)

## 테스트 실행
- 명령: `npm run test:ci` 30회 연속, `npm test`
- 결과: 30회 모두 fail 0, `npm test` pass 64 / fail 0
- 실패 항목: 이번 수정 뒤 실패 없음 (기준 커밋에서는 ci/batch.test.js와 ci/archive.test.js가 간헐 실패)
