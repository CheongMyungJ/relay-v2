## 재현
- 재현 절차: `for i in $(seq 1 20); do node --test ci/archive.test.js; done`
- 결과: 재현됨
- 기대: 20회 모두 통과
- 실제: 20회 중 9회 실패. `ENOENT: 파일이 없습니다: reports/2026-09/.musfjp0l.tmp` (job-1, 3, 7 등 매번 다름). `npm test`는 통과(62 pass).

## 원인
- 원인: (1) `saveReport`의 임시 파일 이름이 `.${stamp(now())}.tmp`라 같은 ms에 동시에 저장하는 보고서끼리 이름이 겹친다. 먼저 끝난 쪽이 rename으로 임시 파일을 옮기면 다른 쪽 rename이 ENOENT. (2) `runPool`이 완료 순서로 `results.push`해, 조회 지연 jitter로 같은 묶음 안 완료 순서가 바뀌면 `collectResults`가 인덱스로 짝짓는 outcome이 다른 작업의 것이 된다(고객사 불일치).
- 근거: src/store/report-archive.js:23(임시 이름에 reportId 없음), src/runner/pool.js(results.push). 수정 후 `npm run test:ci` 20회 반복 모두 통과. 로컬은 지연이 없어 완료 순서가 입력 순서와 같고 stamp도 겹치지 않아 통과한다.
- 사람 추정 판정: "실패 로그는 매번 조금씩 다르다. 주로 .tmp ENOENT, 가끔 report-6 고객사 불일치" — 맞음. 두 증상이 위 두 원인에 각각 대응한다. "로컬 npm test는 늘 통과" — 맞음, 지연이 없기 때문.
- 기각한 가설: 병렬도 문제라 줄여야 함 — 비목표이자 팀 규칙. 원인은 순서/이름 충돌이라 병렬을 유지한 채 고쳤다. 재시도·시간 제한 증가 — 팀 규칙으로 쓰지 않음.

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름에 reportId를 넣어 동시 저장끼리 겹치지 않게 함
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 items 순서로 돌려줌. onChunk의 done은 별도 카운터

## 재현 테스트
- 위치: test/pool.test.js "결과는 완료 순서가 아니라 입력 순서", test/archive.test.js "같은 ms에 동시에 저장해도 임시 파일이 겹치지 않는다"
- 수정 전: pool 시험은 실패(`npm test`: not ok 31, fail 1). archive 시험은 수정 전에도 통과: 시험에서 sleep을 가짜로 바꿔 시간이 즉시 흘러 저장이 겹치지 않음. 이 시험은 회귀 방지용이고, 임시 이름 충돌의 재현은 ci/archive.test.js 반복 실행이 한다.
- 수정 후: 통과 (`npm test` 64 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 20회 반복
- 결과: npm test 64 pass / 0 fail. test:ci 20회 모두 통과.
- 실패 항목: 없음 (수정 전 ci/archive.test.js 실패는 기준 커밋에서도 실패)
