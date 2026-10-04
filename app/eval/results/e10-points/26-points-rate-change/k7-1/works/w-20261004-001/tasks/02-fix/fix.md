## 재현
- 재현 절차: 작업 디렉터리에서 `node src/cli.js examples/O-1042.json` (추가로 `examples/O-1107.json`, `examples/G-0213.json`)
- 결과: 재현됨
- 기대: O-1042 적립 예정 237P (상품 28,270 − 쿠폰 3,000 − 사용 1,500 = 23,770의 1% = 237.7 → 버림 237)
- 실제: 268P (결제 금액 26,770의 1%를 반올림). O-1107은 273P(기대 243P)

## 원인
- 원인: `earnPoints`가 배송비가 포함된 결제 금액(`amounts.total`)에 `percentOf`(Math.round)를 적용했다. 배송비가 있는 주문은 배송비 3,000원의 1%(30P)만큼 많게 나오고, 반올림 때문에 1P가 더 붙을 수 있다. 배송비가 없는 주문(O-1077)은 total과 적립 기준 금액이 같아 어긋나지 않는다.
- 근거: `src/points/earn.js:5`(수정 전), `src/money.js` `percentOf`. 같은 계산이 `src/gift/gift-points.js`와 `src/orders/refund.js`(부분 환불 회수, `percentOf(refundGoods, …)`)에 따로 복제돼 있었다. 수정 전 코드에서 새 테스트 4건이 실패하고, 수정 후 통과했다.
- 사람 추정 판정: 없음
- 기각한 가설: 적립률(`POINT_RATE_PERCENT`) 문제 — 비목표이고 1%는 안내 기준과 같다. 배송비와 반올림이 차이를 모두 설명한다.

## 변경 요약
- `src/money.js` — 소수점 버림 `percentFloor` 추가
- `src/points/earn.js` — `earnOn(금액)`을 단일 기준으로 두고, `earnPoints`는 상품 − 쿠폰 − 사용 포인트(배송비 제외)에 적용
- `src/gift/gift-points.js` — `earnPoints`를 그대로 쓰도록 변경(선물하기 동일 기준)
- `src/orders/refund.js` — 부분 환불 회수를 `earnOn(refundGoods)`로 변경(버림, 적립보다 많이 회수하지 않음)
- 기존 테스트 변경 없음. 주문 저장값과 영수증은 `points.earned`를 쓰므로 자동으로 맞는다. 전체 취소는 저장값을 그대로 회수한다.

## 재현 테스트
- 위치: `test/order.test.js`(O-1042 배송비 있음, O-1077 배송비 없음, O-1107), `test/gift.test.js`(선물하기), `test/refund.test.js`(회수 버림)
- 수정 전: 실패 — `git checkout -- src && npm test`: 4건 not ok (pass 21 / fail 4)
- 수정 후: 통과 — `npm test`: pass 25 / fail 0
- 결과 확인: 수정 후 CLI O-1042 237P, O-1107 243P. O-1077은 403P(기준 금액 40,310, 변함없음)

## 테스트 실행
- 명령: `npm test`
- 결과: 25개 통과, 0개 실패
- 실패 항목: 없음
