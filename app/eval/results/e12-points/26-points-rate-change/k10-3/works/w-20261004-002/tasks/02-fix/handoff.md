---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "earnPoints는 건드리지 않고 earn.js에 earnBase와 pointsForBase만 추가해 환불이 쓴다"
    why: "이미 적립된 포인트와 주문 적립 방식은 비목표이며 앞 Work(w-20261004-001)가 고치는 중(docs/knowledge/points/earn-base.md)"
    by: ai
assumptions:
  - "전체 환불 합계 테스트는 쿠폰 없는 주문으로 한다(쿠폰이 있으면 전체 환불이 전체 취소 오류가 됨)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: earn.js에 같은 이름 earnBase/pointsForBase가 있으면 머지 충돌이 나니 한쪽으로 합쳐야 함. earnPoints와 gift-points.js는 이 브랜치에서 아직 옛 반올림 기준"
  - "옛 기준으로 저장된 과거 주문을 부분 환불하면 회수 값이 저장 적립과 어긋날 수 있음(소급 수정 안 함)"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수는 환불 전후 기준 금액 적립(1% 버림)의 차이로 계산한다. O-1077/R-0311은 403−271=132P"
---
## 요약
부분 환불 회수 포인트를 환불 상품 금액의 1% 반올림에서, 환불 전후 기준 금액 적립(버림)의 차이로 바꿔 R-0311이 131P에서 132P가 됐다. `npm test` 22개 통과.
## 다음 task가 알아야 할 것
- `src/orders/refund.js`: 회수 계산, `src/points/earn.js`: `earnBase`, `pointsForBase` 추가.
- 테스트: `test/refund-points.test.js`(수정 전 2개 실패, 수정 후 통과). 기존 테스트는 변경 없음.
- 확인: `node src/cli.js examples/R-0311.json --order examples/O-1077.json`는 -132P.
- 머지 시 w-20261004-001과 earn.js 충돌 가능.
