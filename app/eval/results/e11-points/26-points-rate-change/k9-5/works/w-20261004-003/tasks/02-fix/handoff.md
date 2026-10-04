---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립은 earnBase(상품 − 쿠폰 − 사용 포인트)와 earnOnBase(버림)로 계산하고 일반 주문, 선물하기, 부분 환불 회수가 모두 쓴다"
    why: "팀 지식 docs/knowledge/points/earn-rule.md의 규칙"
    by: ai
  - what: "부분 환불 회수는 환불 전 기준액 적립 − 환불 후 기준액 적립, 쿠폰과 사용 포인트는 남은 주문에 그대로 둔다"
    why: "팀 지식 earn-rule.md와 refund.js의 기존 설명(쿠폰·사용 포인트는 남은 주문에 둔다)"
    by: ai
assumptions:
  - "이미 일부 환불된 주문의 환불 전 기준액은 alreadyRefunded 상품 금액을 뺀 상품금액으로 계산한다"
rejected:
  - "비율만 2%로 변경: 547P가 되어 기대값 486P와 팀 지식 규칙에 어긋남"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 3개의 기대값을 바꿈(order 500→1000, gift 300→600, refund 100→200). 적립률 정책 변경에 따른 것이며 약화는 아님"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: earn.js/refund.js 기준액 계산이 겹쳐 머지 시 충돌 가능"
  - "예시 파일 O-1042/O-1077 등의 저장된 적립값은 다시 계산하지 않음"
recommended_next: null
knowledge_candidates:
  - "적립률은 2%다(POINT_RATE_PERCENT). 2026-10 배포부터 적용 (사람)"
---
## 요약
적립률을 2%로 올리고 적립 기준액을 배송비 제외 금액으로 바꿨다. O-1107은 486P다. 일반 주문, 선물하기, 부분 환불 회수가 같은 함수를 쓴다. `npm test` 22개 통과.
## 다음 task가 알아야 할 것
- `src/points/earn.js` `earnBase`/`earnOnBase`, `src/money.js` `floorPercentOf`.
- `src/orders/refund.js` `pointsRecovered()`: 환불 전/후 기준액 적립 차이.
- `cancelOrder`와 `src/format/receipt.js`는 저장된 `points.earned`/`pointsRecovered`만 쓰며 변경 없음.
- 기존 테스트 기대값 3곳 변경(적립률 2%).
- 커밋 1개, 테스트: `npm test`.
