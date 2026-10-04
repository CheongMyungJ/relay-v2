## docs/knowledge/earn-points-rule.md

# 적립 포인트는 (상품 금액 - 쿠폰 - 사용 포인트)의 1%를 원 미만 버림한다

- 종류: 규칙
- 적용: src/points/earn.js
- 출처: 사람이 알려 줌(고객센터 기준 237P), 조사로 알아냄, relay Work w-20261004-001, 2026-10-04

- 배송비는 적립 대상이 아니다. 쿠폰 할인과 사용 포인트는 뺀다. 1%의 원 미만은 반올림이 아니라 버린다.
- 예: O-1042는 28,270 - 3,000 - 1,500 = 23,770 → 237.7 → 237P. 배송비 포함(268P)이나 반올림(238P)은 틀리다.
- 이 기준은 O-1042 한 건에서 역산했다. 일반 주문 적립(`earnPoints`)에 적용했다.
- 부분 환불 회수(`src/orders/refund.js`)는 아직 반올림(`percentOf`)이라 기준이 다르다.

## docs/knowledge/gift-points-do-not-touch.md

# 선물하기 적립(src/gift/gift-points.js)은 다른 팀과 함께 보고 있어 손대지 않는다

- 종류: 규칙
- 적용: src/gift/gift-points.js
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

- 일반 주문 적립 버그를 고칠 때 선물하기 적립 코드는 수정하지 않는다. 다른 팀과 협의가 필요하다.
- 선물하기 적립은 여전히 `percentOf(total)`(배송비 포함, 반올림)이라 같은 기준 문제가 남아 있을 수 있다 (예: G-0213 249P).

## docs/knowledge/keep-earned-points-stored.md

# 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다

- 종류: 규칙
- 적용: src/orders/order.js, src/orders/refund.js, src/points/
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

- 주문을 만들 때 계산한 `order.points.earned`는 저장값이다. 이미 적립된 주문은 계산 기준이 바뀌어도 다시 계산하지 않고 저장값을 그대로 쓴다.
- 예: 전체 취소의 회수 포인트는 `order.points.earned`를 쓴다.
- 계산 기준을 고치면 앞으로 만드는 주문에만 적용된다.

## docs/knowledge/receipt-text-unchanged.md

# 영수증 글자(src/format/)는 바뀌면 안 된다

- 종류: 규칙
- 적용: src/format/
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

- 영수증 출력 글자 형식은 계산 버그를 고칠 때도 그대로 둔다. 금액 계산을 고쳐 숫자가 달라지는 것은 괜찮지만 줄 이름, 간격, 단위 표기는 바꾸지 않는다.
- 확인: 수정 전후 `node src/cli.js examples/O-1042.json` 출력을 비교해 값이 바뀐 줄만 다른지 본다.
