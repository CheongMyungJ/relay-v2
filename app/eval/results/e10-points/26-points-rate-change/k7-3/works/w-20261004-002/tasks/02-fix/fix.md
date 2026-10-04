## 재현
- 재현 절차: 작업 디렉터리에서 `examples/O-1077.json`과 `examples/R-0311.json`을 읽어 `createRefund(order, input)`을 호출하고 `pointsRecovered`를 확인한다.
- 결과: 재현됨
- 기대: `pointsRecovered` 132 (403 - floor((34,180 - 5,000 - 2,000) × 1%) = 403 - 271)
- 실제: 131 (`percentOf(13,130, 1)` = 131.3 → 반올림 131)

## 원인
- 원인: `createRefund`가 회수 포인트를 "환불 상품 금액 × 1% 반올림"으로 계산한다. 저장된 적립과 남은 상품 기준 재계산 적립의 차이로 계산하지 않아, 쿠폰·사용 포인트가 낀 주문에서 정산팀 값과 1~2P 어긋난다.
- 근거: `src/orders/refund.js`의 `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)`, `src/money.js`의 `percentOf`는 `Math.round`. 수정 뒤 같은 입력에서 132가 나온다.
- 사람 추정 판정: 없음
- 기각한 가설: 환불 상품 금액 × 1% 올림 — 사람이 올림이 아니라고 답함(intake). 팀 지식의 "환불 상품 금액 × 1% 버림" — O-1077에서 131이라 정산팀 값 132와 맞지 않고, 이번에 사람이 알려 준 식을 따르라는 제약이 있다.

## 변경 요약
- `src/money.js` — 버림 도우미 `floorPercentOf` 추가(`percentOf`는 그대로).
- `src/orders/refund.js` — 회수 = 저장 적립 - 남은 상품 기준 재계산 적립(버림). 이전 부분 환불이 있으면 그때까지 회수된 몫(저장 적립 - 이전 시점 재계산 적립)을 빼서 나눠 환불해도 중복 회수하지 않게 했다. `refundAmount`, `cancelOrder`, `earn.js`는 건드리지 않았다.
- `test/refund.test.js` — 테스트 2개 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: `test/refund.test.js`의 "부분 환불 회수: 저장된 적립 - 남은 상품 기준 재계산 적립(버림)", "나눠 환불해도 회수 합계는 한 번에 환불한 것과 같다"
- 수정 전: 실패 (`npm test` → 첫 테스트 `not ok 21`, 131 ≠ 132, pass 21 / fail 1). 두 번째 테스트는 반올림 우연으로 수정 전에도 통과(66+66=132).
- 수정 후: 통과 (`npm test` → pass 22 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0개 실패
- 실패 항목: 없음
