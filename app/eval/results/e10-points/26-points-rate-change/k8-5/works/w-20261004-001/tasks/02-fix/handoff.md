---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립(src/gift/gift-points.js)도 같은 기준으로 고친다"
    why: "선물 주문의 금액 계산은 일반 주문과 같고 같은 식이 복사돼 있다"
    by: human
  - what: "부분 환불의 적립 회수(pointsRecovered)도 소수점 버림으로 맞춘다"
    why: "사람이 '버림으로 맞춘다'를 선택했다"
    by: human
  - what: "적립 대상 금액은 total - shipping, 소수점은 버림으로 한다"
    why: "O-1042 기준 237P와 맞는 유일한 조합(반올림이면 238, 사용 포인트 미차감이면 252)"
    by: ai
assumptions:
  - "고객센터 규칙은 237P 한 건으로 추정했다. O-1107(243P), G-0213(218P)의 기대값은 같은 규칙으로 계산한 값이고 고객센터 확인은 없다"
rejected:
  - "사용 포인트를 빼지 않는 가설: 252P라 237P와 맞지 않는다"
  - "반올림만 버림으로 바꾸는 가설: 26,770원의 버림은 267P라 맞지 않는다"
open_questions: []
intent_deviation: null
risks:
  - "환불 회수를 버림으로 바꿔 부분 환불 시 회수 포인트가 이전보다 1P 적을 수 있다. 환불 줄 합계 회수와 적립액의 일치는 확인하지 않았다"
  - "고객센터 규칙이 문서로 확인되지 않았다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 배송비를 뺀 결제 금액(상품-쿠폰-사용 포인트)의 1%를 소수점 버림한다 (고객센터 기준 O-1042 237P)"
  - "선물하기 적립과 부분 환불 회수는 일반 주문 적립과 같은 소수점 버림 기준으로 맞춘다 (사람)"
---
## 요약
적립이 배송비 포함 금액의 반올림이라 많게 나왔다. 배송비를 뺀 금액의 버림으로 고쳐 O-1042가 237P가 됐다. 선물하기 적립과 환불 회수도 같은 기준으로 맞췄다. `npm test` 26개 통과.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js`, 버림 도우미 `src/money.js`의 `floorPercentOf`
- `src/gift/gift-points.js`는 `earnPoints`로 위임, `src/orders/refund.js`는 `floorPercentOf` 사용
- 새 테스트 `test/earn.test.js`. 수정 전 5개 실패, 수정 후 모두 통과
- `src/format/`은 변경 없음. 저장된 `points.earned`는 다시 계산하지 않는다
