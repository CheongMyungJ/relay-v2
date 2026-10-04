---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 포인트 회수도 소수점 버림으로 맞춤(기준액은 상품 금액 유지)"
    why: "적립은 버림인데 회수는 반올림이라 나눠 환불하면 회수 합계가 적립을 넘을 수 있었음. 환불 합계가 적립 기준액 이하라 버림이면 넘지 않음"
    by: ai
  - what: "`percentOf`는 그대로 두고 `floorPercentOf`를 새로 추가"
    why: "선물하기 적립(범위 밖)이 percentOf를 쓴다"
    by: ai
assumptions:
  - "고객센터 안내 문서는 확인하지 못했고 237P에 맞춘 계산식을 따랐다"
rejected:
  - "배송비 제외 + 반올림: 238P라 237P와 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "쿠폰·사용 포인트를 쓴 주문의 부분 환불 회수는 상품 금액 기준이라 적립 비례보다 조금 많을 수 있다(적립 합계는 넘지 않음)"
  - "무료배송 주문은 배송비가 0이라 기존과 같은 기준액이다(total과 동일). 확인함"
  - "저장된 points.earned는 다시 계산하지 않음. 이미 적립된 주문은 옛 방식 값 그대로"
recommended_next: null
knowledge_candidates:
  - "포인트 적립은 배송비를 제외한 금액(상품 − 쿠폰 − 사용 포인트)의 1%, 소수점 버림이다. 환불 회수도 버림으로 맞춘다 (사람)"
---
## 요약
적립을 배송비 제외, 버림으로 고쳐 O-1042가 237P가 된다. 환불 회수가 반올림이라 어긋나 버림으로 맞췄고 테스트를 추가했다. `npm test` 24개 통과.
## 다음 task가 알아야 할 것
- `src/points/earn.js:6-7`: 새 적립 식. `src/money.js`의 `floorPercentOf` 추가.
- `src/orders/refund.js:34`: 회수를 `floorPercentOf`로 변경.
- 새 테스트: `test/earn.test.js`, `test/refund.test.js` 끝 두 개. 기존 테스트 변경 없음.
- 선물 적립(`src/gift/gift-points.js`)과 `src/format/`은 건드리지 않음.
- 명령: `npm test`, `node src/cli.js examples/O-1042.json` → 237P.
