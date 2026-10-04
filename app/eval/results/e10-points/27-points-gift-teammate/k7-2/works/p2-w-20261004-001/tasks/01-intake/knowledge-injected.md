## docs/knowledge/earn-points-basis-excludes-shipping.md

# 일반 주문 적립 포인트는 (상품 금액 - 쿠폰 - 사용 포인트)의 1%를 1P 단위로 버린다

- 종류: 사실
- 적용: `src/points/earn.js`
- 출처: 조사로 알아냄(고객센터 기준 사례 O-1042 한 건으로 추론), relay Work w-20261004-001, 2026-10-04

배송비는 적립 기준에서 뺀다. 예: O-1042는 28,270 - 3,000 - 1,500 = 23,770원 → 237P. 배송비 포함 26,770원 반올림은 268P로 틀린 값이다.
버림은 고객센터 값 1건으로 추론했다. 부분 환불 회수(`src/orders/refund.js`)는 아직 반올림이라 적립과 규칙이 다르다.

## docs/knowledge/gift-points-shared-with-other-team.md

# 선물하기 적립(`src/gift/gift-points.js`)은 다른 팀과 같이 보고 있어 함부로 바꾸지 않는다

- 종류: 규칙
- 적용: `src/gift/gift-points.js`, `src/gift/gift-order.js`
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

일반 주문 적립 버그를 고칠 때도 선물하기 적립 코드는 바꾸지 않는다. 같은 문제가 있어 보여도 다른 팀과 먼저 맞춘다.
공용 `percentOf`(`src/money.js`, 반올림)를 쓰므로 `percentOf`를 바꾸면 선물하기 적립도 달라진다. 일반 주문 쪽에서 내림이 필요하면 `earnPoints`에서만 처리한다.
이 Work 기준 선물하기는 `amounts.total`(배송비 포함) 반올림이라 일반 주문과 기준이 다르다.

## docs/knowledge/saved-earned-points-never-recalculated.md

# 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다

- 종류: 규칙
- 적용: `src/orders/order.js`(`createOrder`가 `points.earned`를 저장), `src/orders/refund.js`, `src/format/receipt.js`
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

적립 계산식을 고쳐도 저장된 주문의 `points.earned`는 바꾸거나 재계산하지 않는다. 영수증, 전체 취소의 회수는 저장된 값을 읽는다.
적립 계산 수정은 새로 만드는 주문에만 적용된다. 예: 식을 고친 뒤에도 저장된 O-1077의 403P는 그대로여야 한다.
