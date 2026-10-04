---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "적립 기준을 배송비 제외 상품 금액(상품−쿠폰−사용 포인트)으로 하고 원 단위 버림으로 계산한다"
    why: "O-1042가 237P가 되는 기준은 이것뿐이다(23,770원, 반올림이면 238)"
    by: ai
  - what: "부분 환불 회수도 같은 버림 함수를 쓴다"
    why: "반올림이면 전액 환불 시 회수가 적립보다 1P 많아질 수 있다. 환불 규칙(대상 금액)은 바꾸지 않았다"
    by: ai
assumptions:
  - "적립 안내의 정식 기준 문서가 없어 예시 한 건(237P)에서 역산한 기준이다"
rejected:
  - "쿠폰만 뺀 금액 기준: 252P라 237P와 맞지 않음"
  - "배송비만 빼고 반올림 유지: 238P라 237P와 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "기준이 예시 한 건에서 역산한 것이라, 안내 문구가 다르면(예: 환불 회수의 기준 금액) 다시 맞춰야 한다"
  - "부분 환불 회수는 쿠폰·사용 포인트를 안분하지 않고 환불 상품 금액의 1%(버림)라 적립 기준과 완전히 같은 금액은 아니다. 기존 환불 규칙이라 두었다"
  - "`node src/cli.js`는 examples의 O-1077 등을 저장된 값이 아니라 입력으로 다시 계산한다. 저장된 과거 주문은 소급하지 않았다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 배송비를 뺀 상품 금액(상품−쿠폰−사용 포인트)의 1%를 원 단위 버림한 값이다. 일반·선물하기·환불 회수가 `src/points/earn.js`의 `pointsFor`를 함께 쓴다"
---
## 요약
적립 기준을 결제 금액(배송비 포함, 반올림)에서 배송비 제외 상품 금액(버림)으로 고쳤다. O-1042는 268P에서 237P가 된다. 선물하기와 부분 환불 회수도 같은 함수를 쓴다. `npm test` 24건 통과, 수정 전에는 새 테스트 4건이 실패했다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `pointsFor`(버림), `earnPoints`(goods−coupon−pointsUsed)
- `src/gift/gift-points.js`, `src/orders/refund.js:34`가 같은 함수를 쓴다
- 확인: `node src/cli.js examples/O-1042.json`은 237P
- 새 테스트: `test/order.test.js`, `test/gift.test.js`, `test/refund.test.js` 끝부분
