---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "src/gift/gift-points.js만 수정해 giftPoints가 earnPoints를 호출하게 한다"
    why: "원인이 그 파일이라 고치려면 불가피하다. 제약(다른 팀과 먼저 맞춤)에 닿아 사람에게 물었고 사람이 이 방향을 골랐다"
    by: human
assumptions:
  - "고객센터 218P는 일반 주문과 같은 기준이라는 intake의 가정을 그대로 따른다"
rejected:
  - "amounts 계산 수정: 금액은 일반 주문과 같게 계산되고 바꾸면 안 된다"
  - "gift-order.js에서 earnPoints 직접 호출: 제약 대상 파일을 하나 더 바꾸게 된다"
open_questions: []
intent_deviation: null
risks:
  - "다른 팀과 합의 없이 선물하기 적립 기준(배송비 제외, 버림)이 바뀌었다. 사람이 이 수정을 선택했으나 합의는 확인되지 않았다"
  - "부분 환불 회수(refund.js)는 반올림이라 선물 주문 환불 때 적립과 회수가 1P 어긋날 수 있다. 이번엔 바꾸지 않았다"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립은 일반 주문 earnPoints와 같은 기준(배송비 제외, 1P 버림)으로 바꿨다. 다른 팀과 합의는 확인되지 않았다 (사람이 gift-points.js만 수정하는 것을 선택)"
---
## 요약
G-0213 적립이 249P로 나온 원인은 giftPoints가 배송비 포함 total을 반올림한 것이었다. giftPoints가 earnPoints를 호출하게 고쳐 218P가 된다. 재현 테스트 2개를 추가했고 npm test 26개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js` (earnPoints 호출). 테스트: `test/gift.test.js` 마지막 두 개
- 수정 전 재현 테스트 실패, 수정 후 통과 확인함
- `src/orders/refund.js`는 반올림 회수라 선물 환불과 1P 차이 가능
