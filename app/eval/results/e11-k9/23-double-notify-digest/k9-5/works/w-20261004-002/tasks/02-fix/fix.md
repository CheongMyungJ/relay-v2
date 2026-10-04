## 재현
- 재현 절차: `node --test test/digest.test.js` (새로 추가한 테스트 8개 중 6개가 수정 전 실패(1개는 테스트 시각 오류로 실패해 테스트를 고침, 1개는 회귀 방지용으로 통과)). 수동 확인은 요약 1건을 모은 뒤 (a) 메일 transport가 3.5초 걸려 성공하게 하고 `notifier.digest.tick()`, (b) `notifier.digest.run({ period })`를 두 번 호출.
- 결과: 재현됨
- 기대: 같은 날 같은 고객에게 요약 메일 1통
- 실제: (a) 느린 성공 뒤 재시도로 2통 (b) 재실행마다 1통씩 추가(재실행 3번 + 느린 성공이면 3통). 겹친 실행도 2통, 실행 도중 오류가 나면 그 날 요약이 영영 안 나감.

## 원인
- 원인: 중복 경로가 둘이고 하루 누락 경로가 하나 있다. (1) `withDeadline`이 성공한 발송도 `sendTimeoutMs`(3초)를 넘기면 시간 초과 오류로 던져, runner가 이미 나간 메일을 일시적 오류로 보고 재시도한다. (2) 발송 키에 runId(기본값이 실행 시각)가 들어 있어 같은 기간을 다시 실행(재시작으로 scheduler의 lastPeriod가 사라진 경우, 수동 run, 동시 tick+run)하면 키가 달라 발송 기록이 막지 못한다. 두 경로가 겹치면 "가끔 세 통"이 된다. (3) scheduler가 실행 전에 `lastPeriod`를 기록해, 실행이 예외로 끝나면 그 기간을 다시 시도하지 않는다.
- 근거: `src/digest/deadline.js`의 throw, `src/digest/key.js`의 runId, `src/digest/scheduler.js`의 lastPeriod 선기록. 수정 전 테스트 실패: 느린 성공 실제 2통, 재실행 실제 2통, 재실행+느린 성공 3통, 동시 실행 2통, 재시도+느린 성공 호출 3회, 도중 오류 뒤 0통. 수정 후 전부 통과. 일시적 오류 재시도와 영구 오류 처리는 수정 전후 동일하게 통과(실패한 발송의 재시도 유지).
- 사람 추정 판정: 없음
- 기각한 가설: 메일 transport/어댑터가 같은 메시지를 두 번 보낸다 — 어댑터는 호출당 한 번만 deliver하며, 호출 수가 늘어난 것은 runner 재시도 때문(calls 수로 확인). dedupe(수신 중복 제거)가 원인이다 — 요약함 add가 같은 이벤트를 한 번만 담고 기존 테스트로 확인됨.

## 변경 요약
- src/digest/key.js — 키에서 runId 제거(`digest:{period}:{userId}`). 실행별 집계는 발송 기록의 runId로 유지.
- src/digest/deadline.js — 성공하면 던지지 않고 `elapsedMs`와 `slow`만 돌려줌.
- src/digest/runner.js — 새 키 사용, 느린 성공은 `digest.send.slow` 지표로만 기록, 같은 기간의 실행이 겹치면 하나로 합침(`running` 맵).
- src/digest/scheduler.js — `lastPeriod`를 실행이 끝난 뒤에 기록.
- test/digest.test.js — 테스트 8개 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/digest.test.js 마지막 8개 (예약 실행, 재실행, 재실행+느린 성공, 동시 실행, 재시도 경로, 실패 후 재발송, 도중 오류 뒤 누락 없음, 이틀 연속)
- 수정 전: 실패 — `node --test test/digest.test.js` 8개 중 6개 실패 (위 근거 참조). 실패 후 재발송 테스트는 수정 전에도 통과하는 회귀 방지용이고, 이틀 연속 테스트는 시각 오류를 고친 뒤 수정 전에도 통과.
- 수정 후: 통과 — `npm test` 82개 통과, 실패 0.

## 테스트 실행
- 명령: `npm test`
- 결과: 82 통과, 0 실패
- 실패 항목: 없음
