## 재현
- 재현 절차: `for i in $(seq 1 20); do node --test ci/batch.test.js >/dev/null 2>&1 && echo -n P || echo -n F; done` (같은 방식으로 `ci/archive.test.js`도 반복)
- 결과: 재현됨
- 기대: 20회 모두 통과, report-N은 job-N
- 실제: batch.test.js 20회 중 7회 실패(`PPFFPPFFFPPPPPPPFPPP`, `expected report-6 to belong to job-6, got job-5`). 수정 중 `npm run test:ci`에서 `ci/archive.test.js`도 간헐 실패함(15회 중 8회 실패): `ENOENT ... reports/2026-09/.musdo6mh.tmp`, 보관본 고객사 뒤바뀜(acme 기대, globex 실제).

## 원인
- 원인: (1) `runPool`이 결과를 작업이 끝난 순서로 `push`해서 `collectResults`가 index로 짝지을 때 지연이 다르면 job과 결과가 어긋난다. (2) `saveReport`의 임시 파일 이름이 `stamp(now())`(ms)뿐이라 같은 ms에 시작한 동시 저장 둘이 같은 임시 파일을 쓰고 rename이 서로 덮거나 ENOENT가 난다.
- 근거: `src/runner/pool.js:16-19`(push), `src/collect/collector.js:40`(`outcomes[i]`로 짝짓기), `src/store/report-archive.js:23`. 수정 뒤 batch.test.js 20회 모두 통과, archive.test.js 20회 모두 통과. 로컬 `npm test`는 지연이 없어 완료 순서와 입력 순서가 같아 통과했다.
- 사람 추정 판정: "로컬 `npm test`는 항상 통과하고 지연이 있는 CI 전용 시험에서만 실패" — 맞음 — 지연이 있어야 완료 순서가 입력 순서와 달라진다(test/pool.test.js 신규 시험은 지연 순서를 주면 항상 재현).
- 기각한 가설: 없음

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 입력 순서를 유지. `done`은 별도 카운터로 유지(onChunk 값 동일). 동시 4개 유지.
- src/store/report-archive.js — 임시 파일 이름에 reportId를 넣어 동시 저장끼리 겹치지 않게 함. `.`로 시작하고 `.tmp`로 끝나는 규칙은 그대로.
- test/pool.test.js, test/archive.test.js — 재현 시험 추가(기존 시험 변경 없음).

## 재현 테스트
- 위치: test/pool.test.js '결과는 끝난 순서가 아니라 입력 순서대로 돌려준다', test/archive.test.js '같은 순간에 동시에 저장해도 임시 파일 이름이 겹치지 않는다'
- 수정 전: 실패 (`node --test test/pool.test.js` → fail 1, `node --test test/archive.test.js` → fail 1)
- 수정 후: 통과 (두 파일 모두 fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci`(10회 반복), `ci/batch.test.js` 20회, `ci/archive.test.js` 20회
- 결과: npm test 64 pass/0 fail. test:ci 10회 모두 fail 0. batch.test.js 20/20 통과, archive.test.js 20/20 통과.
- 실패 항목: 없음 (수정 전 실패한 ci 시험은 기준 커밋에서도 간헐 실패)
