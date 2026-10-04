## 재현
- 재현 절차: `npm test` (수정 전 상태에 새 테스트만 추가해 실행). 가상 시계에서 요약함에 알림 1건을 넣고 `clock.set(NEXT_MORNING)` 뒤 `notifier.digest.tick()`/`run()`.
  - A: 메일 어댑터가 3500ms 걸려 성공(`outcomes: [{ latencyMs: 3500 }]`)
  - B: `tick()` 뒤 `run({ period, runId: 'after-restart' })` 재실행, 또는 서로 다른 runId 두 실행을 동시에 실행
- 결과: 재현됨
- 기대: 고객에게 요약 메일 1통 (`mail.sent.length === 1`)
- 실제: A는 성공했는데 시간 초과로 처리돼 재시도되어 2~3통(`calls`도 여러 번), B는 실행마다 새 키라 실행 수만큼 발송

## 원인
- 원인: (1) `withDeadline`이 정상 반환한 발송도 걸린 시간이 `sendTimeoutMs`(3000ms)를 넘으면 `SendTimeoutError`로 바꿔, 이미 도착한 요약을 재시도로 다시 보낸다. (2) `digestKey`에 `runId`가 들어 있어 재기동·수동 재실행·다른 서버/동시 실행은 같은 날짜 요약도 새 키가 되고, 중복 방지(`ledger.has`)가 듣지 않는다. 동시 실행은 `has`와 `markSent` 사이 간격도 문제였다.
- 근거: `src/digest/deadline.js` 수정 전 17~19줄의 elapsed 검사, `src/digest/key.js`의 `digest:${period}:${runId}:${userId}`. 수정 전 새 테스트 3건(느린 성공, 재실행, 동시 실행) 실패, 수정 후 통과. 느린 메일(응답 300ms 기본이 아니라 3초 초과)에서만 2~3통이 나가는 점, 평소엔 한 통인 점이 (1)과 맞고, 재기동 직후 `scheduler.lastPeriod`가 메모리라 초기화되어 같은 기간을 다시 돌리는 점이 (2)와 맞는다.
- 사람 추정 판정: 없음
- 기각한 가설: 스케줄러가 같은 기간을 두 번 돈다 — 한 프로세스에서는 `lastPeriod`로 막히고(기존 테스트 '하루 한 번만 돈다'), 재기동으로 다시 돌아도 (2)를 고치면 발송 키가 막아 주므로 별도 수정 불필요. 재시도 횟수·정책 축소 — 팀 규칙상 하지 않음.

## 변경 요약
- src/digest/deadline.js — 정상 반환한 발송은 느려도 성공으로 돌려주고 `slow` 플래그만 알린다. 시간 초과는 어댑터가 던지는 오류로만 드러난다.
- src/digest/runner.js — `slow`면 `digest.slow` 지표와 경고 로그만 남긴다. 발송 전 `ledger.claim(key)`로 키를 차지하고 실패하면 `release`한다.
- src/digest/key.js — 키에서 `runId`를 뺀다(`digest:<period>:<userId>`). 실행별 집계는 ledger entry의 runId로 그대로 가능.
- src/digest/ledger.js — 진행 중 키 집합과 `claim`/`release` 추가, `has`가 진행 중도 포함.
- test/digest.test.js — 테스트 5건 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/digest.test.js 마지막 5건
- 수정 전: 실패 — `npm test` 결과 pass 76 / fail 3 (33 느린 성공, 34 재실행, 35 동시 실행)
- 수정 후: 통과 — `npm test` pass 79 / fail 0

## 테스트 실행
- 명령: `npm test`
- 결과: 79건 모두 통과 (기준 커밋은 74건 통과)
- 실패 항목: 없음

### 경로별 한 번 수신 근거
| 경로 | 테스트 | 결과 |
|---|---|---|
| 느린 성공 → 재시도 | [중복 방지/느린 성공] | 통과, 1통 |
| 재기동·수동 재실행 | [중복 방지/재실행] | 통과, 1통 |
| 동시·다중 서버 실행 | [중복 방지/동시 실행] | 통과, 1통 |
| 예약 실행(tick) 하루 한 번 | 일정은 아침 8시 전에는 보내지 않고, 하루 한 번만 돈다 | 통과 |
| 실제 실패는 재시도 | [재시도 유지/시간 초과 실패], 일시적 오류는 잠시 뒤 다시 보낸다 | 통과, 재시도 후 1통 |
| 실패 뒤 다음 실행 | [재시도 유지/실패 뒤 재실행] | 통과, 1통 |
