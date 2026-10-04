---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "업무 유형 bugfix를 그대로 유지한다"
    why: "요청은 정책 변경에 가까워 유형이 맞지 않는다고 물었고, 사람이 bugfix 유지를 골랐다"
    by: human
assumptions:
  - "적립률 2%는 일반 주문, 선물하기, 부분 환불의 재계산 적립에 모두 적용한다 (모두 POINT_RATE_PERCENT를 쓴다)"
  - "O-1107 기대값 486P는 팀 지식의 기준 금액 규칙으로 계산하면 24,330 × 2% = 486.6 → 486으로 맞는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이미 1%로 적립된 주문을 부분 환불할 때, 원래 적립(1%) − 남은 상품 재계산 적립(2%)이면 회수액이 모자라거나 음수가 될 수 있다. 요청에 이 경우의 규칙이 없어 intent에 넣지 않았다"
  - "기준 브랜치에는 아직 earnBase가 없다(앞 Work w-20261004-002에서 고쳤을 수 있음, 머지 대기). 지금 earn.js는 order.amounts.total에 비율을 곱한다"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 이미 1%로 적립된 주문의 부분 환불 회수에 새 2%를 어떻게 쓸지 — 정산팀 확인 필요, 지금 코드는 환불 상품 금액에 POINT_RATE_PERCENT를 곱함"
---
## 요약
적립률을 1%에서 2%로 올리는 intent 초안을 썼다. 저장된 적립 값과 영수증 글자는 바꾸지 않는다.
## 다음 task가 알아야 할 것
- 비율은 `src/config.js:9` `POINT_RATE_PERCENT = 1` 한 곳이고 `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`가 쓴다.
- 팀 지식 참고: `docs/knowledge/points/earn-rule.md` (기준 브랜치에는 아직 없음)
- 테스트 명령: `npm test` (node --test)
- O-1107 계산: 12,900 + 2,890×5 = 27,350 → 24,330 → 2% = 486.6 → 486P
- 환불 회수 계산(`refund.js`)이 1%로 적립된 옛 주문에 2%를 쓰면 어긋날 수 있다. fix에서 확인할 것.
