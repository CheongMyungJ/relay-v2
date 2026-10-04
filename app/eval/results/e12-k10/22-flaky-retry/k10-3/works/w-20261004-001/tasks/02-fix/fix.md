## 재현
- 재현 절차: `for i in 1 2 3 4 5 6; do node --test ci/batch.test.js; done`, 이어서 `npm run test:ci`를 반복
- 결과: 재현됨
- 기대: report-N은 job-N에 대응하고, ci/archive.test.js도 통과
- 실제: 6번 중 2번 `expected report-3 to belong to job-3, got job-2`. `npm run test:ci`는 가끔 ci/archive.test.js 2건도 실패(보관본 누락/내용 뒤바뀜)

## 원인
- 원인: (1) `runPool`이 결과를 작업이 끝난 순서대로 `push`하는데 `collectResults`는 인덱스로 job과 짝지어, 지연 때문에 끝나는 순서가 바뀌면 report가 다른 job에 붙는다. (2) `saveReport`의 임시 파일 이름이 `.<stamp(now())>.tmp`라서 같은 ms에 동시에 저장하면 같은 이름을 쓰고 rename하여 보고서가 뒤바뀌거나 사라진다. 두 건 모두 동시 실행 + 지연에서만 드러난다.
- 근거: src/runner/pool.js `results.push(result)`와 src/collect/collector.js `jobs.map((job, i) => toRecord(job, outcomes[i]))`; src/store/report-archive.js의 tmp 이름. 지연이 없는 로컬 `npm test`는 완료 순서가 입력 순서와 같아 통과. 수정 뒤 `ci/batch.test.js` 30회, `npm run test:ci` 30회 모두 실패 0.
- 사람 추정 판정: 없음 (추가 의견 없음)
- 기각한 가설: report.js/jitter 문제 — 핸들러는 payload만 쓰고 상태를 공유하지 않으며 jitter는 지연만 바꿈. 지연이 순서를 바꾸는 것이 원인.

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 담아 입력 순서 유지, `done`은 별도 카운터
- src/store/report-archive.js — 임시 파일 이름에 reportId 추가
- test/pool.test.js, test/archive.test.js — 재현 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/pool.test.js '결과는 끝난 순서가 아니라 입력 순서다', test/archive.test.js '같은 시각에 동시에 저장해도 임시 파일이 겹치지 않는다'
- 수정 전: 실패 (pool.js를 되돌리고 `npm test` → fail 1; archive 시험도 수정 전 fail 1)
- 수정 후: 통과 (`npm test` → pass 64, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci`(30회 반복), `node --test ci/batch.test.js`(30회)
- 결과: 모두 통과
- 실패 항목: 수정 전 간헐 실패는 기준 커밋에서도 발생함. 수정 뒤 실패 없음
