## 재현
- 재현 절차: `npm test` — 기준 커밋(92c70b5)에 `test/digest.test.js`의 새 테스트만 얹어 실행. 가상 시계 + 가짜 메일 transport로 요약을 돌린다.
  - 느린 성공: `digestSetup({ mail: { outcomes: [{ latencyMs: 3500 }] } })` 후 `notifier.digest.tick()`
  - 재실행: `tick()` 뒤 `notifier.digest.run({ period: '2026-09-21' })`
- 결과: 재현됨
- 기대: 같은 기간 요약은 고객(mina@example.com)에게 1통
- 실제: 느린 성공은 2통(연이어 느리면 3통 — 문의의 "두 통, 가끔 세 통"과 일치), 재실행·스케줄러 재시작·동시 실행은 각각 2통

## 원인
- 원인: 두 가지가 겹친다. (1) `withDeadline`이 성공했어도 3초(`digest.sendTimeoutMs`)를 넘기면 `SendTimeoutError`를 던져 runner가 이미 간 요약을 재시도한다(최대 3회). (2) 요약 키에 `runId`(기본값은 실행 시각)가 들어 있어 재실행·재시작마다 키가 달라지고, 보낸 기록 검사가 무력해진다. 거기에 검사(`has`)와 기록(`markSent`)이 발송 전후로 떨어져 있어 겹쳐 도는 실행은 둘 다 보낸다.
- 근거: `src/digest/deadline.js`(수정 전) 시간 검사 후 throw, `src/digest/key.js`(수정 전) `digest:${period}:${runId}:${userId}`, `src/digest/runner.js` 기본 runId에 `new Date(clock.now())`. 수정 전 새 테스트 5건 실패(느린 성공 2, 수동 재실행, 스케줄러 재실행, 동시 실행). 수정 뒤 모두 통과. 재현 조건 설명: 메일 응답이 3초 넘게 걸릴 때만 재시도 중복, 응답이 빠르고 같은 실행 안이면 기존처럼 1통 — 기존 테스트가 통과한 이유와 맞다.
- 사람 추정 판정: 없음
- 기각한 가설: 재시도 로직 자체의 결함(백오프·횟수) — 실제 실패(일시 오류, 실제 timeout)는 정상으로 재시도되고 중복이 없음을 테스트로 확인. 재시도를 끄거나 줄이는 방향은 제약상 하지 않음.

## 변경 요약
- src/digest/deadline.js — 시간 초과를 던지지 않고 `slow` 표시만 반환. 성공을 실패로 보지 않게 함.
- src/digest/runner.js — 느린 성공은 지표(`digest.slow`)와 경고 로그만 남김. 발송 전 `ledger.claim`, 실패 시 `release`.
- src/digest/key.js — 키에서 `runId` 제거(`digest:${period}:${userId}`). 실행별 집계는 기록의 `runId`로 가능(`runSummary` 그대로).
- src/digest/ledger.js — 보내는 중인 키 `claim`/`release` 추가, `has`가 보내는 중인 키도 포함.
- test/digest.test.js — 경로별 테스트 8건 추가(기존 테스트는 변경 없음).

## 재현 테스트
- 위치: test/digest.test.js 의 "재시도 경로", "수동 재실행 경로", "스케줄러 재실행 경로", "동시 실행 경로", "실패한 요약은 다시 보내고…"(2건), "실제 시간 초과 실패는 계속 재시도한다"
- 수정 전: 실패 (`npm test` → 82개 중 5개 실패: 재시도 경로 2, 수동 재실행, 스케줄러 재실행, 동시 실행). 실패 재시도 3건은 수정 전에도 통과(회귀 방지용)
- 수정 후: 통과 (`npm test` → 82개 모두 통과)
- 프로세스 재시작은 메모리 저장소라 실제 재시작을 흉내 낼 수 없어, 새 스케줄러(lastPeriod 초기화)가 같은 ledger로 다시 돌리는 것으로 대신 검증. 운영에서는 ledger가 재시작 뒤에도 남아야 한다.

## 테스트 실행
- 명령: `npm test`
- 결과: 82개 통과, 0 실패
- 실패 항목: 없음 (기준 커밋은 새 테스트를 뺀 74개 모두 통과)
