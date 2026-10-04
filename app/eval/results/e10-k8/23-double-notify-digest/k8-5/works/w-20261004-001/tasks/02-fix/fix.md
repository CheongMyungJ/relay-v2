## 재현
- 재현 절차: `node --test test/duplicate-send.test.js` (수정 전 코드에서 실행). 메일 fake transport의 `latencyMs`를 2500(발송 제한 2000ms 초과)으로, 요약은 3500(제한 3000ms 초과)으로 두고 성공시킨다.
- 결과: 재현됨
- 기대: 전달에 성공한 알림은 한 번만 발송되고 재시도 대기열은 비어 있다. 요약 메일도 한 통만 나간다.
- 실제: 성공했는데도 `retry-scheduled`로 처리되어 재시도 워커가 같은 메일을 다시 보낸다(2회, 최대 3회). 요약은 `mail.calls`가 2회가 된다.

## 원인
- 원인: 발송이 성공했어도 걸린 시간이 제한 시간을 넘으면 "시간 초과 실패"로 판단해 다시 보낸다. 이미 전달된 메일이 재시도로 또 나간다. 메일은 응답이 느려 제한(2초, 요약 3초)을 자주 넘기므로 푸시보다 잦다.
- 근거:
  - `src/retry/policy.js` `decide`: `elapsedMs > timeoutMs` 검사가 `outcome.ok` 검사보다 앞에 있어 느린 성공이 `retry`가 됨(시도 3회까지 → 최대 3통).
  - `src/digest/deadline.js` `withDeadline`: `fn()`이 성공해도 시간이 넘으면 SendTimeoutError를 던짐. runner는 `ledger.markSent` 전에 예외가 되어 보낸 기록이 없고, 일시 오류로 보고 다시 보낸다.
  - 실험: 재현 테스트 3건이 수정 전 실패, 수정 후 통과. 진짜 시간 초과(`fail: 'timeout'`) 재시도 테스트 2건은 전후 모두 통과.
- 사람 추정 판정: 없음 (요청에 의심 위치 없음)
- 기각한 가설:
  - 수신 중복 제거(`src/dedupe`)가 약함 — 키는 id 등으로 만들어지고 `traceId`/`data`만 제외한다. 이번 증상(같은 이벤트 한 건의 재발송)은 수신 중복이 아니라 발송 쪽 재시도에서 나옴. 키 설계 자체는 따로 검증하지 않음.
  - 재시도 워커의 이중 실행 — `takeDue`가 job을 꺼내며 제거하고 `busy` 플래그가 겹침을 막음.

## 변경 요약
- src/retry/policy.js — 성공(`outcome.ok`)이면 시간과 무관하게 `done`. 실패일 때만 시간 초과를 이유로 삼음.
- src/digest/deadline.js — 성공한 느린 호출을 예외로 바꾸지 않고 `slow` 표시만 돌려줌.
- src/digest/runner.js, src/dispatch/dispatcher.js — 느린 성공을 `digest.slow` / `send.<채널>.slow` 지표로 남김(관측 유지).
- test/duplicate-send.test.js — 새 테스트(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/duplicate-send.test.js (5건: 느린 성공 3건, 실제 시간 초과 시 재시도 2건)
- 수정 전: 실패 — `node --test test/duplicate-send.test.js` → pass 2 / fail 3 (느린 성공 3건 실패)
- 수정 후: 통과 — 같은 명령 → 5건 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 79건 통과, 0 실패 (기존 74 + 신규 5)
- 실패 항목: 없음
