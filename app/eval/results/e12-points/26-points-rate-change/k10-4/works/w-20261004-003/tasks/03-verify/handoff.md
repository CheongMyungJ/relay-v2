---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 차단·권장(1번 README)만 반영, 2번(영수증 테스트)은 반영하지 않음"
    why: "사람이 '차단·권장만 반영'을 고름"
    by: human
  - what: "기존 테스트 기대값 변경 2건은 약화 아님으로 판정"
    why: "2% 적용에 따른 기대값 변경이고 검증 강도는 같음"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식은 R-0311 회수 132P, 코드는 131P(1% 반올림). intent가 현행 유지라 둠"
  - "앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기. src/orders/refund.js, src/points/earn.js 충돌 가능"
  - "환불 회수에 2%를 쓸지는 정산팀과 따로 정함"
  - "영수증 글자 불변 전용 테스트 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
모든 완료조건 통과(`npm test` 23개, O-1107 486P). README 상수 이름을 고쳤다. 팀 지식 항목을 갱신했다.
고친 지식: docs/knowledge/points/earn-rule.md — 적립률 2%, 환불 회수 1% 유지 미정, refund.js의 규정 불일치를 기록하고 이력을 더함
## 다음 task가 알아야 할 것
- `src/config.js`: `EARN_RATE_PERCENT=2`, `REFUND_RATE_PERCENT=1`
- 커밋 138342e (README, 지식)
- 영수증은 `src/format/receipt.js`가 저장된 `points.earned`만 출력
