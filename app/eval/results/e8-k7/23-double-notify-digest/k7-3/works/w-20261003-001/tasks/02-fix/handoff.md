---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "성공한 발송은 걸린 시간과 무관하게 성공으로 처리하고, 실제 실패만 기존 정책대로 재시도"
    why: "intent: 전달된 알림은 다시 보내지 않고 실패한 발송은 재시도해야 함 (재시도 정책은 비목표)"
    by: ai
  - what: "요약 경로의 withDeadline은 예외 대신 slow 플래그로 느림을 알림"
    why: "같은 원인이 요약 메일에도 있어 같은 버그 범위로 판단"
    by: ai
assumptions:
  - "메일이 더 잦은 이유는 메일 지연이 제한 시간에 더 가깝기 때문일 것이라는 추정이며 운영 데이터로 확인하지 않음"
rejected:
  - "수신 중복 제거 결함: 중복 수신 없이도 재현되고 기존 테스트가 한 번만 발송됨을 보장함"
  - "재시도 큐 job 중복 추출: takeDue가 shift로 꺼내 중복 없음"
open_questions: []
intent_deviation: null
risks:
  - "실제로 느리게 실패한 영구 오류는 여전히 timeout으로 분류되어 재시도됨(이번 범위 밖, 동작 유지)"
  - "요약 발송 키(digestKey)에 runId가 들어 있어 프로세스 재시작 등으로 같은 기간을 다시 run하면 별도 중복 가능성이 있음. 재현하지 못해 손대지 않음"
  - "전송 자체가 timeout 오류를 던졌지만 실제로는 전달된 경우는 transport 멱등성 없이는 막을 수 없음"
recommended_next: null
knowledge_candidates:
  - "응답이 제한 시간보다 늦어도 성공한 발송은 성공이다. 시간 초과로 보고 재시도하면 중복 발송된다 (src/retry/policy.js decide, src/digest/deadline.js)"
---
## 요약
성공했지만 응답이 제한 시간(발송 2초, 요약 3초)을 넘긴 발송을 시간 초과로 보고 재시도해 중복이 생기던 문제를 고쳤다. 일반 발송(메일·푸시)과 요약 메일 모두 해당. 재시도 정책은 그대로이고 실제 실패만 재시도한다.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js`(ok 먼저 검사), `src/digest/deadline.js`(slow 플래그), `src/digest/runner.js`(digest.send.slow 지표)
- 회귀 테스트: `test/duplicate-send.test.js` 6건, 수정 전 느린 성공 3건 실패
- `npm test`: 80건 모두 통과 (기존 테스트 변경 없음)
- 남은 위험: `digestKey`의 runId 포함(`src/digest/key.js`)은 건드리지 않음
