---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "일반 발송(policy.js)과 요약 발송(deadline.js) 두 경로를 모두 고친다"
    why: "원인이 같다(성공을 느리다고 실패로 취급). 메일 중복의 요약 경로도 intent의 '채널당 한 번'에 해당"
    by: ai
  - what: "성공 판정은 소요 시간과 무관하게 하고, 실패 시의 시간 초과 재시도 규칙은 유지"
    why: "재시도 정책 약화 금지(비목표)"
    by: ai
assumptions:
  - "어댑터가 값을 돌려줬으면 상대 서버가 수락한 것으로 본다"
rejected:
  - "dedupe 문제: 수신 단계에만 적용되고 재시도 경로를 거치지 않음"
  - "재시도 워커 이중 실행: takeDue가 꺼내며 제거함"
open_questions: []
intent_deviation: null
risks:
  - "digestKey에 runId가 들어 있어 같은 기간을 다른 runId로 다시 돌리면(다중 서버·수동 재실행) 요약이 중복될 수 있음. 이번 재현과 무관해 수정하지 않음"
  - "제한 시간을 넘긴 요약 발송이 더 이상 중단/실패되지 않아 아침 일괄 발송이 느려질 수 있음(지표로만 관찰)"
recommended_next: null
knowledge_candidates:
  - "발송이 성공했으면 소요 시간이 제한 시간을 넘어도 성공으로 본다. 늦은 성공을 실패로 재시도하면 중복 전달된다 (src/retry/policy.js, src/digest/deadline.js)"
---
## 요약
느리게 성공한 발송을 시간 초과 실패로 보고 재시도해 같은 알림이 2~3번 나가던 것이 원인이다. 일반 발송과 요약 발송 두 곳을 고쳤고 실제 실패의 재시도는 그대로다.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js:13`, `src/digest/deadline.js:13`
- 테스트: `npm test` 78 통과. 새 테스트 4건(retry/notifier 2/digest), 기존 테스트 변경 없음
- 남은 위험: `src/digest/key.js`의 runId 포함 키(재실행 시 중복 가능)
