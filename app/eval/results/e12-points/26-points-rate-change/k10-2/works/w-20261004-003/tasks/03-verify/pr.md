# 적립률 2%로 상향, 적립 기준과 환불 회수를 새 적립률에 맞춤

## 요약
기본 적립률 `POINT_RATE_PERCENT`를 1%에서 2%로 올렸다. 적립 기준을 (상품 − 쿠폰 − 사용 포인트) 버림으로 맞춰 O-1107이 486P 적립된다.

## 원인
- 적립률 상수가 1이었다.
- `earnPoints`가 결제 금액(배송비 포함)을 반올림해 팀 기준과 달랐다. 상수만 2로 올리면 O-1107이 547P가 된다.
- 부분 환불 회수가 환불 상품 금액의 %라 저장된 적립과 어긋났다. 적립률이 바뀌면 옛 주문 회수가 틀어진다.

## 변경
- `src/config.js`: 적립률 2, 옛 주문용 `LEGACY_POINT_RATE_PERCENT = 1`
- `src/money.js`, `src/points/earn.js`: 버림 `floorPercentOf`, `earnFromBasis`
- `src/orders/order.js`, `src/gift/gift-order.js`: 주문에 `points.ratePercent` 저장
- `src/orders/refund.js`: 회수 = 저장된 적립 − 남은 상품 재계산 적립(저장된 적립률, 없으면 1%). 전체 취소는 저장값 그대로
- 선물하기 적립 계산 방식과 `src/format/`은 그대로
- `docs/knowledge/points/earn-basis.md` 갱신
- 확인 필요: 선물하기 적립을 2%로 올릴지는 미정이라 지금은 상수를 따라 2%

## 테스트
- `npm test`: 28개 통과
- 재현 테스트 `test/earn-rate.test.js` 추가, 적립률 변경으로 달라진 기존 기대값만 수정(order, gift, refund)
