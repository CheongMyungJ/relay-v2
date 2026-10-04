## 재현
- 재현 절차: 저장소 루트에서 `node -e "import('./src/gift/gift-order.js').then(async m=>{const fs=await import('fs');const g=m.createGiftOrder(JSON.parse(fs.readFileSync('examples/G-0213.json','utf8')));console.log(g.amounts,g.points)})"`
- 결과: 재현됨
- 기대: `points.earned` = 218
- 실제: 249 (`amounts` = goods 24860, coupon 2000, shipping 3000, pointsUsed 1000, total 24860)

## 원인
- 원인: `giftPoints`가 일반 주문의 적립 함수 `earnPoints`를 쓰지 않고 `percentOf(order.amounts.total, POINT_RATE_PERCENT)`를 직접 계산했다. 배송비를 뺀 결제 금액이 아니라 `total`을 기준으로 했고, 버림이 아니라 반올림했다.
- 근거: `src/gift/gift-points.js`(수정 전)는 total 기준 반올림이었다. `src/points/earn.js`는 `(goods - coupon - pointsUsed)`의 1%를 버림한다. 재현 출력 `earned: 249`. 24860의 1%는 248.6이고 반올림하면 249이다. 21860의 1%를 버림하면 218이다. 일반 주문은 `earnPoints`를 거치므로 이 문제가 없다(`src/orders/order.js:35`). 수정 전 테스트 2건이 실패했고 수정 후 통과했다. 이것이 원인이라는 실험이 된다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — `giftPoints`가 `earnPoints(order)`를 부르게 바꿨다. 일반 주문과 같은 기준(`docs/knowledge/points/earn-basis.md`)을 쓰기 위해서다.
- test/gift.test.js — 테스트 2건을 추가했다. 기존 테스트는 바꾸지 않았다.

## 재현 테스트
- 위치: `test/gift.test.js` — "G-0213의 적립 예정 포인트는 218P", "선물하기 주문의 적립은 같은 상품·금액의 일반 주문과 같다"
- 수정 전: 실패 (`npm test` → 2건 실패, expected 218, actual 249, 통과 25 / 실패 2)
- 수정 후: 통과 (`npm test` → 통과 27 / 실패 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 27건 통과, 0건 실패
- 실패 항목: 없음
