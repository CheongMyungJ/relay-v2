---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 배송비 제외(상품 − 쿠폰 − 사용 포인트), 원 단위 버림"
    why: "O-1042의 고객센터 값 237P와 일치하는 조합"
    by: human
  - what: "선물하기 적립(giftPoints)도 같은 기준으로 함께 고친다"
    why: "같은 계산식을 쓴다"
    by: human
  - what: "저장된 기존 주문의 적립 포인트 보정은 비목표"
    why: "코드 수정만 범위로 함"
    by: human
assumptions:
  - "적립 안내 원문은 레포에 없고, 기준은 사람이 확인해 준 것을 따른다"
rejected:
  - "배송비 제외 + 반올림: O-1042가 238P가 되어 237P와 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "배송비 제외 후 사용 포인트가 상품 금액을 넘는 경계 사례는 확인하지 않음"
  - "이미 저장된 주문의 적립값은 그대로라 과적립이 남는다"
recommended_next: null
knowledge_candidates:
  - "포인트 적립 기준은 배송비를 제외한 금액(상품 − 쿠폰 − 사용 포인트)의 적립률%를 원 단위 버림한다 (사람)"
---
## 요약
적립 포인트가 배송비를 포함한 결제 금액을 기준으로 반올림되어 많게 나온다는 요청이다. 기준을 배송비 제외 + 버림으로 정하는 intent 초안을 썼다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:5`와 `src/gift/gift-points.js:6`이 `order.amounts.total`에 `percentOf`(반올림, `src/money.js`)를 쓴다. 이 둘이 적립 계산 지점이다.
- O-1042: 상품 28,270, 쿠폰 3,000, 배송비 3,000, 포인트 1,500, total 26,770. 현재 268P, 기대 237P(23,770 × 1%).
- `order.js:35`와 `gift-order.js:36`에서 `points.earned`를 저장한다. 현재 `npm test` 20개 통과.
- `amounts.shipping`이 이미 있어 total − shipping으로 기준 금액을 얻을 수 있다(참고용 가설).
