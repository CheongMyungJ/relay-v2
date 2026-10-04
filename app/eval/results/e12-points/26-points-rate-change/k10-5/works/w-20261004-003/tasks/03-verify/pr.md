# 적립률을 2%로 올리고 적립 기준을 배송비 제외·버림으로 변경

## 요약
기본 적립률(`POINT_RATE_PERCENT`)을 1%에서 2%로 올린다. 신규 일반 주문은 `상품 − 쿠폰 − 사용 포인트`(배송비 제외)의 2%를 버림해 적립한다. 부분 환불 회수는 지금 동작(1%)을 유지한다.

## 원인
상수가 1%였고, `earnPoints`는 배송비를 포함한 결제 금액을 반올림했다. 같은 상수를 환불 회수도 써서 상수만 바꾸면 환불 회수와 O-1107 적립(547P, 기대 486P)이 어긋났다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT = 2`, 환불 회수용 `REFUND_RECOVER_RATE_PERCENT = 1` 추가
- `src/points/earn.js`, `src/money.js`: 배송비 제외 기준과 버림(`floorPercentOf`)
- `src/orders/refund.js`: 회수 비율을 분리 상수로 교체(동작 동일)
- 선물하기 적립(`gift-points.js`)은 그대로이며 비율만 2%를 따른다. `src/format/`, 저장된 `points.earned`는 바꾸지 않는다.
- `docs/knowledge/points/earn-basis.md`: 적립률 2%와 환불 회수 적용 여부 미정 사항을 기록

## 테스트
- `npm test`: 22 통과
- `node src/cli.js examples/O-1107.json` → 486P, G-0213 → 497P, R-0311 환불 회수 131P(변경 전과 동일)
- 기대값 변경: order 500→1000, gift 300→600(2% 반영). O-1107·환불 1% 유지 테스트 추가
