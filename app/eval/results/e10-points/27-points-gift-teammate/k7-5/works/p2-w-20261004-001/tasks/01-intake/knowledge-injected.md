## docs/knowledge/gift-points-hands-off.md

# 선물하기 적립(src/gift/gift-points.js)은 다른 팀과 같이 보고 있어 손대지 않는다

- 종류: 규칙
- 적용: src/gift/gift-points.js, 공유 함수 percentOf(src/money.js)
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

선물하기 적립은 다른 팀과 함께 보는 중이라 일반 주문 수정에서 바꾸지 않는다.
`percentOf`는 gift-points.js와 refund.js가 공유하므로 고치면 선물하기 적립도 바뀐다. 일반 주문은 earn.js 안에서만 계산한다.
(선물하기는 지금 배송비 포함·반올림 기준이 남아 있다. 바꾸려면 그 팀과 먼저 정한다.)

## docs/knowledge/no-recalc-saved-points.md

# 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다

- 종류: 규칙
- 적용: src/orders/order.js, src/orders/refund.js, 포인트 적립 계산 전반
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

적립 계산 규칙을 바꿔도 이미 저장된 주문의 `points.earned`는 재계산하거나 바꾸지 않는다.
영수증·환불·포인트 내역은 주문을 만들 때 저장한 값을 쓴다. 새 규칙은 새로 만드는 주문에만 적용된다.

## docs/knowledge/receipt-text-unchanged.md

# 영수증 글자(src/format/)는 앱과 메일이 그대로 보여 주므로 바뀌면 안 된다

- 종류: 규칙
- 적용: src/format/
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

영수증 출력 문자열은 앱과 메일이 그대로 보여 준다. 계산 버그를 고칠 때도 형식 코드는 건드리지 않고 계산 쪽에서 고친다.

## docs/knowledge/regular-order-points-rule.md

# 일반 주문 적립은 배송비를 뺀 결제 금액에 적립률을 곱하고 원 단위로 버린다

- 종류: 규칙
- 적용: src/points/earn.js (일반 주문 O-), POINT_RATE_PERCENT(src/config.js)
- 출처: 조사로 알아냄(고객센터 기준 237P에서 역산), relay Work w-20261004-001, 2026-10-04

적립 = floor((상품 - 쿠폰 - 사용 포인트) × 적립률 / 100). 배송비는 뺀다.
예: O-1042는 23,770원 × 1% = 237.7 → 237P. 배송비 포함 26,770원 반올림은 268P로 틀리다.
배송비만 빼고 반올림하면 238, 포함하고 버림하면 267이라 둘 다 필요하다.
환불 회수(src/orders/refund.js의 부분 환불)는 아직 반올림이라 1P 어긋날 수 있다.
