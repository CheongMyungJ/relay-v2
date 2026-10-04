---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트가 음수가 되지 않도록 0으로 하한을 둔다"
    why: "저장된 적립이 재계산 적립보다 작은 비정상 입력에서 음수 회수를 막기 위한 방어. 의도에 없는 판단이라 기록"
    by: ai
assumptions:
  - "alreadyRefunded가 있으면 남은 상품 금액에서도 뺀다(기존 remainingGoods 사용)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "0 하한은 의도에 명시되지 않은 동작. 정상 데이터에서는 작동하지 않음"
  - "src/gift/gift-points.js 등 다른 반올림 코드는 범위 밖. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "부분 환불 포인트 회수 = 주문에 저장된 적립 − 남은 상품으로 재계산한 적립(상품 금액−쿠폰−사용 포인트의 1%, 배송비 제외, 1P 미만 버림). 쿠폰과 사용 포인트는 남은 주문에 그대로 둔다 (사람)"
  - "고칠 지식: docs/knowledge/points/earn-rule.md — src/orders/refund.js 환불 회수는 반올림이 아니라 재계산 차이 방식으로 고쳤다 (사람)"
---
## 요약
부분 환불 회수 포인트를 "저장된 적립 − 남은 상품 기준 재계산 적립(버림)"으로 고쳤다. O-1077/R-0311은 132P, alreadyRefunded 케이스도 규칙대로 나온다. `npm test` 22개 통과.
## 다음 task가 알아야 할 것
- 변경: `src/orders/refund.js` createRefund 끝부분(remainingEarn). `refundAmount`와 `src/format/`은 건드리지 않음.
- 테스트 2개 추가(test/refund.test.js 하단), 기존 테스트 변경 없음. 기준 커밋 src로는 새 테스트 2개 실패 확인.
- 검증 숫자: alreadyRefunded(KT-2290×1)+TW-0838×1 → 남은 26,030−7,000=19,030 → 190P, 403−190=213P.
