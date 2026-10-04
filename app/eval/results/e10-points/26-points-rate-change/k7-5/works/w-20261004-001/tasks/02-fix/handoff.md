---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "일반 주문과 선물하기 주문이 같은 earnPoints를 쓰게 한다"
    why: "기준을 한 곳에 두어 둘이 어긋나지 않게 하려는 것이고, 의도의 범위(일반+선물)와 같다"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수(refund.js)는 상품 금액 1% 반올림이라 새 적립 기준과 어긋날 수 있다. 이번 범위 밖"
recommended_next: null
knowledge_candidates:
  - "포인트 적립 기준은 배송비를 뺀 금액(상품−쿠폰−사용 포인트)의 1% 내림이다 (사람)"
---
## 요약
적립을 배송비 제외 금액의 1% 내림으로 고쳤고 일반·선물하기 주문이 같은 함수를 쓴다. 재현 테스트를 추가했고 npm test 24개가 통과한다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `earnBase`, `earnPoints`. `src/gift/gift-points.js`는 위임
- O-1042 237P, G-0213 218P, O-1107 243P, O-1077 423P(변화 없음)
- 새 테스트 `test/earn.test.js`
- `cancelOrder`는 저장된 `points.earned`를 그대로 쓴다(수정 안 함)
