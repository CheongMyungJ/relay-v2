---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 2(푸시 느린 성공 테스트)만 반영하고 1(slow 노출)은 반영하지 않음"
    why: "사람이 2만 반영을 선택"
    by: human
assumptions: []
rejected:
  - "지적 1: slow를 로그/지표로 노출 — 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "느린 성공(slow)을 지표로 남기지 않음"
  - "실제 운영 지연 분포는 확인하지 못함"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(모두 사소) 중 푸시 테스트 추가만 반영(a82969f). 완료조건 6건 모두 통과, `npm test` 78 pass. 수정 전 코드에서는 새 테스트 3건이 실패함을 다시 확인했다.
새 지식: docs/knowledge/dispatch/retry-only-failed-sends.md — 맞는 기존 항목이 없는 까닭: docs/knowledge가 없었음
## 다음 task가 알아야 할 것
- 원인 위치: `src/retry/policy.js` `decide()`, `src/digest/deadline.js` `withDeadline()`
- `src/digest/runner.js:50`은 `slow`를 쓰지 않음
- 산출물: verification.md, pr.md
