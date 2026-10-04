## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json | grep 적립`
- 결과: 재현됨
- 기대: 적립 예정 237P
- 실제: 268P

## 원인
- 원인: `earnPoints`가 배송비를 더하고 포인트를 뺀 결제 금액(`amounts.total`)에 반올림 `percentOf`를 적용했다. 안내 기준은 배송비 제외, 쿠폰·포인트 차감 후 상품 금액, 버림이다. 부분 환불 회수도 `percentOf`(반올림)라 같은 식으로 어긋났다.
- 근거: `src/points/earn.js:6`(수정 전), `src/orders/refund.js:34`(수정 전). O-1042: total 26,770 × 1% = 267.7 → 268. 기준 금액 23,770 → 237.7 → 237. 수정 전 코드로 되돌리면 새 테스트 4개가 실패하고 수정하면 O-1042가 237P가 됨(실험함).
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/money.js — 버림 방식 `floorPercentOf` 추가
- src/points/earn.js — (goods − coupon − pointsUsed)의 적립률%, 버림. 배송비 제외
- src/orders/refund.js — 부분 환불 회수를 `floorPercentOf(refundGoods, rate)`로. 쿠폰·사용 포인트가 남은 주문에 남고 `remainingGoods ≥ coupon + pointsUsed`로 제한되므로, 환불 상품 금액 합 ≤ 차감 후 상품 금액이고 버림 합 ≤ 버림이라 회수 합이 적립을 넘지 않는다. 전체 취소(`cancelOrder`)는 코드 변경 없음(저장값 그대로).
- test/order.test.js, test/refund.test.js — 테스트 추가(기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/order.test.js(적립 5개), test/refund.test.js(회수 2개)
- 수정 전: 실패 — `git checkout b7eefd5 -- src && npm test`: 4개 실패(배송비 있는 주문, 소수점 버림, O-1042 237P, 부분 환불 버림)
- 수정 후: 통과 — `npm test`: 27개 통과
- 참고: 배송비 없는 주문, 쿠폰·포인트 차감 테스트는 기존 코드에서도 값이 우연히 같아 통과한다(회귀 방지용).

## 테스트 실행
- 명령: `npm test`
- 결과: 27 pass, 0 fail
- 실패 항목: 없음. `src/format/`, `test/receipt.test.js`는 바뀌지 않음
