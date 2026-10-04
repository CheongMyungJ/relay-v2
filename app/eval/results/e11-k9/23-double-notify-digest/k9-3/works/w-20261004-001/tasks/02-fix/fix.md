## 재현
- 재현 절차: `test/no-double-send.test.js`를 수정 전 코드에서 `npm test`로 실행한다. 가상 시계와 가짜 전송으로 다음을 만든다.
  1. 메일/푸시 전송이 2500ms 걸려 성공(제한 시간 기본 2000ms)한 뒤 재시도 워커를 돌린다.
  2. 요약 메일 전송이 3500ms 걸려 성공(요약 제한 3000ms)한다.
  3. 같은 기간으로 `digest.run({ period })`를 두 번 돌린다.
  4. 같은 이벤트(id 동일, `deliveryAttempt: 2`)를 30초 뒤 다시 `handle`한다.
- 결과: 재현됨
- 기대: 위 네 경우 모두 고객에게 한 번만 간다 (메일 `sent.length === 1`).
- 실제: 수정 전 5개 테스트 실패 (메일/푸시 느린 성공, 요약 느린 성공, 요약 재실행, 늦게 다시 온 이벤트). 느린 성공은 재시도 대기열에 들어가 한 번 더 발송됐고, 요약 재실행과 늦게 온 이벤트는 새 발송이 됐다.

## 원인
- 원인: "보내기는 성공했지만 늦게 끝난 것"을 실패(timeout)로 보고 재시도해서 이미 간 알림을 또 보낸다. 같은 이벤트·요약을 다시 처리할 때 이미 보낸 것을 알아보는 키가 매번 달라지는 것이 겹친다.
- 근거:
  - `src/retry/policy.js` `decide`: `elapsedMs > timeoutMs` 검사가 `outcome.ok`보다 앞이라 성공도 `retry`가 된다. 메일 기본 지연 400ms는 환경에서 느려지기 쉽고, 요약 메일도 같다. 메일이 더 자주 겪는 이유는 메일 전송이 푸시(80ms)보다 느려 제한 시간을 넘기기 쉽기 때문이라고 본다(가짜 전송 기본값 기준의 추정).
  - `src/digest/deadline.js` `withDeadline`: 성공한 뒤에도 제한 시간을 넘으면 `SendTimeoutError`를 던진다. 그러면 `markSent`가 안 불리고 runner가 재시도한다.
  - `src/dedupe/key.js`: 키에 `receivedAt`(`receive.js:21`이 수신 때마다 붙임)이 들어가 나중에 다시 온 이벤트는 키가 달라 통과한다. 같은 시각에 두 번 오는 경우만 걸러졌다(기존 테스트가 그것만 확인).
  - `src/digest/key.js`: 키에 `runId`(기본값은 실행 시각 포함)가 들어가 재실행 때 `ledger.has`가 항상 false.
  - 실험: 수정 전 5개 실패, 수정 후 전부 통과.
- 사람 추정 판정: 없음 (요청에 원인 추정 없음)
- 기각한 가설: 없음

## 변경 요약
- `src/retry/policy.js` — `outcome.ok`이면 걸린 시간과 상관없이 `done`. 실패일 때만 timeout 판단.
- `src/dedupe/key.js` — `receivedAt`을 키에서 제외.
- `src/digest/key.js`, `src/digest/runner.js` — 요약 키에서 `runId` 제거(`digest:기간:사용자`). 실행별 집계는 ledger 기록의 `runId` 필드가 이미 있어 유지된다.
- `src/digest/deadline.js` — 성공하면 던지지 않고 `slow` 표시만 돌려준다. runner가 느리면 경고 로그를 남긴다.
- `test/no-double-send.test.js` (새 파일) — 재현 테스트와 "실제 실패는 재발송" 테스트.
- 기존 테스트 변경 없음.

## 재현 테스트
- 위치: `test/no-double-send.test.js` (메일·푸시·요약 각각 성공 후 중복 없음 / 실제 실패는 재발송, 요약 재실행, 늦게 온 이벤트)
- 수정 전: 실패 — `npm test` → 5개 `not ok` (44, 46, 48, 49, 51), 나머지 통과
- 수정 후: 통과 — `npm test` → tests 82, pass 82, fail 0

## 테스트 실행
- 명령: `npm test`
- 결과: 82개 중 82개 통과
- 실패 항목: 없음 (수정 전에도 기존 77개는 모두 통과해 기준 커밋에서 실패하는 항목 없음)
