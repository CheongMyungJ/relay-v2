---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "일반 주문 적립(earn.js)만 고치고 선물하기 적립은 그대로 둔다"
    why: "사람이 '일반 주문만 고침'을 선택"
    by: human
  - what: "환불 회수 포인트(refund.js:34)는 그대로 둔다"
    why: "사람이 '환불은 그대로 둠'을 선택"
    by: human
assumptions:
  - "적립 기준은 total - shipping으로 계산한다. total은 상품 − 쿠폰 + 배송비 − 사용 포인트이므로 규정의 기준과 같다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(src/gift/gift-points.js:6)은 아직 배송비 포함 반올림이라 일반 주문과 규정이 다르다"
  - "환불 회수(src/orders/refund.js:34)는 상품 금액 기준 반올림이라 새 적립값과 어긋날 수 있다 (부분 환불)"
recommended_next: null
knowledge_candidates:
  - "아직 규칙을 따르지 않음: src/gift/gift-points.js — 배송비 포함 결제 금액 반올림, 사람이 이번 범위에서 뺌 (사람)"
  - "아직 규칙을 따르지 않음: src/orders/refund.js:34 — 환불 상품 금액 기준 반올림 회수, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
`earnPoints`가 배송비를 뺀 금액의 1%를 1P 미만 버림으로 계산하게 고쳤다. O-1042는 237P다. 테스트를 추가했고 `npm test` 24개가 통과한다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:6`: `Math.floor((total - shipping) * rate / 100)`
- 새 테스트: `test/earn.test.js` (수정 전 3개 실패, 수정 후 통과)
- 저장된 `points.earned`를 쓰는 경로(영수증, 환불, 내역)는 건드리지 않았다. `test/receipt.test.js`의 290P는 저장값 그대로다.
- 선물하기 적립과 환불 회수는 범위에서 뺐다.
