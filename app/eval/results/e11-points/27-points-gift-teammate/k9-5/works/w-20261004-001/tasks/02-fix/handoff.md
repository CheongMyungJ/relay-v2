---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 배송비 제외 금액(상품 - 쿠폰 - 사용 포인트)으로 하고 소수는 버린다"
    why: "O-1042가 237P가 되는 조합이 이것뿐이다 (반올림이면 238P). 의도에서 기대값 237P로 정해져 있다"
    by: ai
  - what: "`money.js`의 `percentOf`는 바꾸지 않고 `earn.js`에서 직접 버림 계산한다"
    why: "`gift-points.js`와 환불이 같이 쓰고, 선물하기는 이번에 수정하지 않는 범위다"
    by: ai
assumptions:
  - "고객센터 기준은 배송비 제외 + 버림이다. 237P 한 건으로 추정했고 다른 주문의 고객센터 값은 확인하지 못했다"
rejected:
  - "반올림만 고치는 안: 배송비를 둔 채로는 237P가 안 나온다"
  - "쿠폰·포인트 중복 차감: total에서 이미 한 번만 빠진다"
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(`src/gift/gift-points.js`)은 여전히 total 기준 반올림이라 같은 과다 계산이 남는다. 비목표라 수정하지 않았다"
  - "부분 환불의 회수 포인트(`src/orders/refund.js`)는 상품 금액에 반올림으로 계산해 새 적립 기준과 맞지 않을 수 있다. 범위 밖이라 두었다"
  - "기존 주문의 저장된 값은 재계산하지 않는다. 새로 만드는 주문부터 새 기준이다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 배송비를 뺀 결제 금액(상품 - 쿠폰 - 사용 포인트)의 1%, 원 단위 미만 버림이다 (고객센터 기준, O-1042=237P)"
  - "아직 규칙을 따르지 않음: src/gift/gift-points.js — total 기준 반올림 그대로, 사람이 이번 범위에서 뺌 (사람)"
  - "확인 필요: src/orders/refund.js의 pointsRecovered는 percentOf(상품 금액) 반올림이라 적립 기준과 다르다"
---
## 요약
적립 예정 포인트가 배송비까지 포함한 금액에 1%를 곱해 반올림해서 많게 나왔다. 배송비를 뺀 금액에 버림으로 계산하게 고쳤고 O-1042는 237P가 된다. 재현 테스트를 추가했고 `npm test` 25개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js` (`Math.floor((goods - coupon - pointsUsed) * rate / 100)`), 테스트: `test/earn.test.js`
- 영수증(`src/format/`)과 `src/gift/` 파일은 변경하지 않았다. 영수증은 저장된 `points.earned`를 그대로 보여 준다.
- O-1107은 이제 243P.
- 테스트: `npm test`
