## 재현
- 재현 절차: `node --test test/duplicate-send.test.js` (수정 전 코드에서). 가상 시계와 가짜 transport로 메일 지연 3000ms(제한 2000ms)에 성공시키거나, 요약 지연 5000ms(제한 3000ms)에 성공시키거나, 같은 기간 요약을 runId를 달리해 두 번 돌린다.
- 결과: 재현됨
- 기대: 전달된 알림은 한 번만 발송된다.
- 실제: 느리게 성공한 메일이 `retry-scheduled`가 되어 재시도 때 또 발송된다. 요약도 시간 초과 오류로 처리돼 다시 발송된다. 같은 기간을 다시 돌리면 runId가 달라 이미 보낸 요약을 또 보낸다.

## 원인
- 원인: 발송은 성공했는데 걸린 시간이 제한 시간을 넘으면 실패(timeout)로 보고 재시도했다. 일반 발송은 `src/retry/policy.js`의 `decide`, 요약은 `src/digest/deadline.js`의 `withDeadline`이 같은 방식이다. 요약은 추가로 보낸 키(`src/digest/key.js`)에 runId가 들어 있어 재실행 때 중복 방지가 듣지 않았다.
- 근거: 수정 전 `decide`는 `elapsedMs > timeoutMs`를 `outcome.ok`보다 먼저 검사했다(`policy.js`). `withDeadline`은 `fn()` 성공 뒤에 던졌고 그 때문에 `markSent`가 호출되지 않았다. 메일 기본 지연(400ms)이 푸시(80ms)보다 길어 느려질 때 메일이 더 자주 걸린다. 재현 테스트 4개가 수정 전 실패, 수정 후 통과했다. 실제 실패(timeout 오류)는 그대로 재시도되는 것을 테스트로 확인했다.
- 사람 추정 판정: 없음
- 기각한 가설: 중복 제거(dedupe) 키·저장소 결함 — 같은 이벤트는 `checkAndMark`로 막히고 재현 경로에 관여하지 않았다. 재시도 큐/워커 중복 꺼냄 — `takeDue`가 shift로 꺼내 중복 없음.

## 변경 요약
- src/retry/policy.js — 성공(`outcome.ok`)이면 시간과 관계없이 `done`. 실패일 때만 시간 초과를 사유로 삼는다.
- src/digest/deadline.js — 성공한 발송을 오류로 바꾸지 않고 `slow`만 알려 준다.
- src/digest/key.js, src/digest/runner.js — 보낸 키에서 runId를 뺐다(`digest:기간:사용자`). 실행별 집계는 ledger entry의 runId로 유지된다.
- test/duplicate-send.test.js — 신규 회귀 테스트와 재시도 유지 테스트. 기존 테스트 변경 없음.

## 재현 테스트
- 위치: test/duplicate-send.test.js
- 수정 전: 실패 — `node --test test/duplicate-send.test.js` → pass 1, fail 4 (재시도 유지 테스트만 통과)
- 수정 후: 통과 — 같은 명령 → pass 5, fail 0

## 테스트 실행
- 명령: `npm test`
- 결과: 79개 통과, 0 실패 (기준 커밋은 74개 통과)
- 실패 항목: 없음
