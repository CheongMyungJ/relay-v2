---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "요약 경로(digest/deadline.js)도 같은 원인이라 함께 고침"
    why: "같은 결함(성공을 시간 초과로 판정)이고 중복 발송 버그의 일부라 범위 안으로 봄"
    by: ai
assumptions:
  - "운영의 느린 응답은 제한 시간을 넘겨도 성공으로 끝나는 경우라고 가정함 (운영 로그는 못 봄)"
rejected:
  - "dedupe 키 문제: 중복은 발송 뒤 재시도에서 생김"
open_questions: []
intent_deviation: null
risks:
  - "시간 초과 설정(send.timeoutMs, digest.sendTimeoutMs)은 이제 성공 판정에는 쓰이지 않음. 느린 실패는 여전히 재시도됨"
  - "요약 키(src/digest/key.js)에 runId가 들어가 서로 다른 실행(재실행)에서는 같은 요약이 다시 나갈 수 있음. 이번에 고치지 않음"
  - "어댑터가 오류를 던졌지만 실제로는 상대에게 간 경우는 막지 못함"
recommended_next: null
knowledge_candidates:
  - "발송이 성공했으면 걸린 시간과 무관하게 재발송하지 않는다. 시간 초과 판정은 실패한 발송에만 쓴다 (src/retry/policy.js, src/digest/deadline.js)"
---
## 요약
성공했지만 제한 시간보다 느린 발송을 timeout 실패로 보고 재시도해 중복 발송되던 것을 고쳤다. 발송 경로와 요약 경로 모두 해당했다. 실제 실패는 그대로 재시도한다.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js:13`, `src/digest/deadline.js`
- 테스트: `npm test` 79개 통과. 새 테스트 5개(수정 전 3개 실패 확인).
- 별개 위험: `src/digest/key.js`의 runId 포함.
