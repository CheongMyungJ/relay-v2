---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수는 환불 상품 금액의 적립률%를 버림으로 계산하고 쿠폰·포인트 안분은 하지 않는다"
    why: "쿠폰·사용 포인트는 남은 주문에 두고 남은 상품 금액 ≥ 쿠폰+포인트로 제한되어, 버림 합이 적립(차감 후 금액 버림)을 넘지 않음"
    by: ai
assumptions:
  - "저장된 옛 적립값(반올림, 배송비 포함)이 새 회수 합보다 작은 경우는 확인하지 않음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(gift-points.js)은 옛 기준이라 선물 주문의 적립과 회수가 어긋날 수 있음(비목표)"
  - "옛 기준으로 이미 저장된 주문의 부분 환불 회수는 새 식을 쓴다"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 = 환불 상품 금액의 적립률% 버림. 쿠폰·사용 포인트는 남은 주문에 두므로 안분하지 않는다. src/orders/refund.js"
---
## 요약
적립을 (상품−쿠폰−사용포인트)의 1% 버림으로, 부분 환불 회수를 버림으로 고쳤다. O-1042는 237P. 테스트 7개 추가, `npm test` 27개 통과.
## 다음 task가 알아야 할 것
- `src/points/earn.js:6`, `src/orders/refund.js:34`, `src/money.js`의 `floorPercentOf`.
- 수정 전 코드에서 새 테스트 4개 실패 확인(`git checkout b7eefd5 -- src`).
- 기존 테스트·`src/format/` 변경 없음. 커밋 완료.
