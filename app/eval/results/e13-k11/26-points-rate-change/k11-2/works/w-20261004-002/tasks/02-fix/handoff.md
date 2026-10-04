---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "earnPoints를 고치지 않고 refund.js에 규칙대로의 적립 계산(earnedOn)을 두었다"
    why: "이 브랜치의 earnPoints는 결제 금액 기준·반올림이라 규칙(docs/knowledge/points/earn-rule.md)과 다르다. 고치면 주문 적립까지 바뀌어 범위를 넘고 앞 Work와 충돌한다"
    by: ai
assumptions:
  - "남은 주문의 배송비는 적립에서 제외한다(규칙)"
rejected:
  - "earnPoints 직접 호출: 반올림으로 27,180원이 272P가 되어 여전히 131P"
open_questions: []
intent_deviation: null
risks:
  - "refund.js의 earnedOn은 earnPoints와 중복이다. 앞 Work(w-20261004-001)에서 earnPoints를 고쳤을 수 있음, 머지 대기. 머지 뒤 earnPoints로 합쳐야 한다"
  - "src/gift/gift-points.js와 cancelOrder는 범위 밖이라 그대로 둠"
  - "두 번째 추가 테스트는 수정 전에도 통과한다"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트는 환불 상품 금액의 %가 아니라 전후 남은 주문 적립의 차이다. 쿠폰·사용 포인트가 남은 주문에 남아 있어 따로 계산하면 1~2P 어긋난다 (src/orders/refund.js)"
---
## 요약
부분 환불 회수 포인트를 "환불 전 남은 주문 적립 - 환불 후 남은 주문 적립"으로 고쳤다. R-0311은 131P에서 132P가 된다. `npm test` 22개 통과.
## 다음 task가 알아야 할 것
- `src/orders/refund.js`: `earnedOn`과 `pointsRecovered` 계산
- 이 브랜치의 `src/points/earn.js:6`은 total 기준 반올림이라 쓰지 않았다
- 확인: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → 회수 -132P
- 테스트: `test/refund.test.js` 추가 2개
