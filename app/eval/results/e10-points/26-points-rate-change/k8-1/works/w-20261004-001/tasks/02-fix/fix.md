## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P ((28,270 − 3,000 − 1,500) × 1% = 237.7 → 버림)
- 실제: 268P (결제 금액 26,770원 × 1% = 267.7 → 반올림)

## 원인
- 원인: `earnPoints`가 적립 기준을 `amounts.total`(결제 금액)로 잡았다. total에는 배송비가 더해져 있고, 반올림(`percentOf`)으로 계산해서 규정(배송비 제외, 버림)과 달랐다. 선물하기의 `giftPoints`도 같은 식을 따로 복사해 써서 같은 오차가 있었다.
- 근거: `src/points/earn.js:5`, `src/gift/gift-points.js:6`이 `percentOf(order.amounts.total, ...)`를 썼다. `src/orders/order.js:16`에서 total = goods − coupon + shipping − pointsUsed다. 수정 전 CLI 출력은 268P였다. 수정 후 237P다. 배송비가 없는 주문은 total과 규정상 기준 금액이 같아서 배송비가 붙을 때만 많게 나오고, 반올림은 소수점 이하가 .5 이상일 때만 영향을 준다. 이것이 "조금씩 많다"는 현상을 설명한다.
- 사람 추정 판정: "다른 주문도 적립이 조금씩 많게 나오는 것 같다 / 선물하기 경로도 확인" — 맞음. `giftPoints`가 같은 식으로 계산하고 있었다(G 주문 11,000 → 배송비 포함 기준으로 많게 나옴). 이번에 함께 고쳤다.
- 기각한 가설: 적립률(1%)이 잘못됐다 — 비목표이고 config 값 1%는 규정과 같다. 기준 금액과 반올림 방식이 문제였다.

## 변경 요약
- `src/points/earn.js` — 기준 금액을 goods − coupon − pointsUsed로 바꾸고 `Math.floor`로 버림.
- `src/gift/gift-points.js` — `earnPoints`에 위임해 규정을 한 곳에서 관리.
- `test/earn.test.js` — 새 테스트 5개 추가 (기존 테스트는 변경 없음).

## 재현 테스트
- 위치: `test/earn.test.js`
- 수정 전: 실패 (`npm test` → 25개 중 4개 실패: O-1042 237P, 배송비 있는 주문, 버림, 선물하기)
- 수정 후: 통과 (`npm test` → pass 25, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 25개 통과, 0개 실패
- 실패 항목: 없음
