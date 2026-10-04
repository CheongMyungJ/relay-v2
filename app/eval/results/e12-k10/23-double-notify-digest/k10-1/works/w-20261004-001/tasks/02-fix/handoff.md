---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요약 중복 방지 키에서 runId를 뺀다 (사용자+기간)"
    why: "같은 기간 재실행 시 이미 보낸 요약이 다시 나감. 같은 알림은 한 번만이라는 의도와 README 설명에 맞춤"
    by: ai
assumptions:
  - "중복 기준은 같은 알림, 같은 고객, 같은 채널"
  - "운영 지연 분포는 모르며, 메일이 더 잦은 것은 지연이 길어 제한 시간을 넘기기 쉬워서라고 봄"
rejected:
  - "수신 중복 제거(src/dedupe) 결함: 단일 이벤트에서도 재현되고 동시 수신 테스트가 이미 있음"
  - "재시도 워커가 같은 일을 두 번 꺼냄: takeDue가 꺼내면서 지움"
open_questions: []
intent_deviation: null
risks:
  - "실패했지만 실제로는 상대에게 도착한 경우(응답만 유실)는 막지 못함. 멱등 키가 필요하며 이번 범위 밖"
  - "요약 키 변경 후 같은 기간 재실행은 의도적으로 재발송되지 않음. 강제 재발송이 필요하면 별도 수단이 필요"
recommended_next: null
knowledge_candidates:
  - "성공한 발송은 느려도 재시도하지 않는다. 시간 초과는 실패한 발송에만 적용한다: src/retry/policy.js, src/digest/deadline.js"
  - "요약 중복 방지 키는 사용자+기간이며 runId를 넣지 않는다: src/digest/key.js"
---
## 요약
중복 발송 원인 세 가지를 고쳤다. 성공했지만 제한 시간을 넘긴 발송이 재시도되던 것(즉시 발송, 요약 각각), 요약 키에 runId가 있어 같은 기간 재실행 시 재발송되던 것. 재시도는 그대로이고 실제 실패만 다시 보낸다.
## 다음 task가 알아야 할 것
- `src/retry/policy.js:13` 성공 먼저 판정, `src/digest/deadline.js` 예외 제거, `src/digest/key.js`에서 runId 제거
- 새 테스트: `test/notifier.test.js`, `test/retry.test.js`, `test/digest.test.js` 끝부분
- `npm test`: 80개 통과. 수정 전 새 테스트 4개 실패
- 남은 위험: 응답 유실형 중복은 미해결
