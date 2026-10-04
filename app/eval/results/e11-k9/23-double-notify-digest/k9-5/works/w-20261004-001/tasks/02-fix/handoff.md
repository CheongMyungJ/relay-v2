---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "즉시 발송(policy.decide)과 요약 발송(withDeadline) 두 경로를 모두 고친다"
    why: "같은 원인(성공한 느린 발송을 시간 초과로 재시도)이고, 의도가 모든 채널의 중복 방지를 요구함"
    by: ai
  - what: "실패한 발송이 느리게 실패한 경우의 동작(시간 초과로 재시도)은 그대로 둔다"
    why: "중복과 무관하고 재시도 유지 제약이 있음"
    by: ai
assumptions:
  - "시간 초과 오류를 던지는 어댑터는 실제로 보내지 않은 것으로 본다(타임아웃은 재시도 대상 유지)"
rejected:
  - "재시도 워커가 작업을 중복으로 꺼냄: takeDue가 shift로 꺼내 아님"
  - "dedupe 키 문제: 재시도는 dedupe를 거치지 않음"
open_questions: []
intent_deviation: null
risks:
  - "소켓 타임아웃(ETIMEDOUT)처럼 오류로 끝났지만 실제로는 서버가 보냈을 수 있는 경우는 여전히 재시도되어 중복 가능(멱등 키 없이는 못 막음)"
  - "withDeadline은 이제 제한 시간을 적용하지 않아 timeoutMs 인자가 쓰이지 않음"
recommended_next: null
knowledge_candidates:
  - "발송이 성공했으면 걸린 시간과 관계없이 성공으로 본다. 느린 성공을 시간 초과로 재시도하면 중복 발송이 된다: src/retry/policy.js, src/digest/deadline.js"
---
## 요약
성공했지만 제한 시간(발송 2초, 요약 3초)을 넘긴 발송을 시간 초과로 보고 재시도해 중복이 생기던 것을 고쳤다. 즉시 발송과 요약 두 경로 모두 수정했고 재시도는 그대로다.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js:15`, `src/digest/deadline.js`
- 테스트: `npm test` 77개 통과. 추가 3개는 notifier.test.js 2개, digest.test.js 1개
- `withDeadline`의 `timeoutMs` 인자는 이제 미사용(정리는 범위 밖)
