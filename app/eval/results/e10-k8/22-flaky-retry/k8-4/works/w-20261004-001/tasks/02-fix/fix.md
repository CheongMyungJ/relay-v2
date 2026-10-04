## 재현
- 재현 절차: `for i in 1 2 3 4 5 6; do npm run test:ci; done` (수정 전 기준 커밋)
- 결과: 재현됨
- 기대: `ci/batch.test.js`가 매번 통과하고 각 report가 자기 job에 속한다
- 실제: 6번 중 3번 실패. 예: `expected report-4 to belong to job-4, got job-3`

## 원인
- 원인: 원인이 둘이다. (1) `runPool`이 결과를 끝난 순서대로 `results.push`해서, 조회 지연이 작업마다 달라 순서가 바뀌면 `collectResults`가 인덱스로 짝짓는 job과 결과가 어긋난다. (2) `saveReport`의 임시 파일 이름이 `stamp(now())`뿐이라 같은 ms에 시작한 동시 저장들이 같은 임시 파일을 쓰고 옮겨, 보관본이 다른 고객사의 것으로 섞이거나 저장이 빠진다.
- 근거: `src/runner/pool.js` push 순서, `src/collect/collector.js`의 `outcomes[i]` 짝짓기. 수정 전 `ci/batch.test.js` 실패 재현(위). (1) 수정 뒤 batch는 통과했으나 30번 중 10번은 `ci/archive.test.js`(보관본 고객사 불일치, 저장 누락)가 실패해 (2)를 찾음. 로컬 `npm test`는 지연이 없어(batch/archive CI 시험만 지연 사용) 늘 통과. 실험: 각 수정을 되돌리면 새 재현 테스트가 실패함.
- 사람 추정 판정: "로컬 npm test는 통과하고 CI에서만 가끔 실패" — 맞음. 지연과 jitter가 있는 CI 시험에서만 순서 뒤바뀜과 같은 ms 충돌이 생김.
- 기각한 가설: 시험의 시간 제한/재시도 문제 — 실패가 타임아웃이 아니라 짝 불일치라서 기각.

## 변경 요약
- src/runner/pool.js — 결과를 items 인덱스 위치에 담아 입력 순서를 보장 (병렬 4개 유지). 진행 알림의 done은 별도 카운터.
- src/store/report-archive.js — 임시 파일 이름에 reportId를 넣어 동시 저장끼리 겹치지 않게 함.
- test/pool.test.js, test/archive.test.js — 재현 테스트 추가 (기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/pool.test.js '결과는 끝나는 순서가 아니라 items 순서다', test/archive.test.js '보고서 보관: 같은 시각에 동시에 저장해도 서로 섞이지 않는다'
- 수정 전: 실패 (`npm test`에서 pool 수정만 되돌리면 pass 62 / fail 1, report-archive만 되돌리면 pass 63 / fail 1)
- 수정 후: 통과 (`npm test` pass 64 / fail 0)

## 테스트 실행
- 명령: `npm test`; `npm run test:ci`를 40번 반복
- 결과: `npm test` 64 통과 0 실패. `test:ci` 40번 중 40번 통과 (수정 전 6번 중 3번 실패)
- 실패 항목: 없음 (수정 전 실패는 기준 커밋에서도 재현됨)
