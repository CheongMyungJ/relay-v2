## docs/knowledge/delivery/real-failures-must-be-resent.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 중복 발송은 재시도를 끄지 말고 고친다: 실제로 실패한 발송은 반드시 다시 보낸다

## 규칙
- 중복 발송을 막으려고 재시도를 끄거나 줄이지 않는다. 발송이 실제로 실패했으면 재시도로 다시 보내야 한다.
- 고친 뒤에는 "성공 후에는 다시 안 보냄"과 "실제 실패는 다시 보냄"을 둘 다 테스트로 확인한다 (`test/no-double-send.test.js` 참고).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/delivery/success-beats-timeout.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# 느리게 끝난 성공을 timeout으로 재시도하면 중복 발송이 된다

## 내용
- 발송 성공 판정은 걸린 시간보다 앞선다. 전송이 성공했으면 제한 시간을 넘겼어도 성공이다(이미 고객에게 갔다). 실패일 때만 timeout을 따진다. 위치: `src/retry/policy.js`(`decide`), `src/digest/deadline.js`(`withDeadline`는 `slow`만 알리고 던지지 않는다).
- 중복 제거 키(`src/dedupe/key.js`)와 요약 키(`src/digest/key.js`)에는 매번 달라지는 값(`receivedAt`, `runId`)을 넣지 않는다. 넣으면 다시 온 이벤트나 재실행을 알아보지 못한다. 실행별 집계는 ledger 기록의 `runId` 필드로 한다.
- 같은 id 이벤트는 24시간 창 안에서 항상 중복으로 본다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
