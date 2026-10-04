## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json | grep 적립`
- 결과: 재현됨
- 기대: 적립 예정 237P (23,770원 × 1%, 소수점 버림)
- 실제: 268P (결제 금액 26,770원 × 1%, 반올림)

## 원인
- 원인: `earnPoints`가 배송비가 포함된 `order.amounts.total`에 `percentOf`(반올림)를 적용했다. 기준 금액에 배송비 3,000원이 들어가고 끝수도 반올림됐다.
- 근거: `src/points/earn.js` 수정 전 `percentOf(order.amounts.total, ...)`. `total = goods - coupon + shipping - pointsUsed`(`src/orders/order.js:17`)이므로 26,770원 → 267.7 → 268. 수정 후 같은 명령이 237P를 출력. `src/gift/gift-points.js`는 `earnPoints`를 쓰지 않고 `percentOf`만 따로 쓰므로 `money.js`의 `percentOf`는 고치지 않았다.
- 사람 추정 판정: 없음
- 기각한 가설: `percentOf`의 반올림을 바로 floor로 바꾼다 — `gift-points.js`와 `refund.js`가 같이 쓰므로 선물하기 적립이 바뀐다(비목표 위반).

## 변경 요약
- src/points/earn.js — 기준 금액을 `goods - coupon - pointsUsed`(배송비 제외)로, 끝수는 `Math.floor`로 바꿨다. `percentOf` 의존 제거.
- test/earn.test.js — 새 테스트 4개 (O-1042, 배송비 무료 주문, 소수점 버림, 배송비 제외).

## 재현 테스트
- 위치: test/earn.test.js
- 수정 전: 실패 (`npm test` → 3건 not ok: O-1042 237P, 소수점 버림, 배송비 제외. 배송비 무료 주문은 원래 통과)
- 수정 후: 통과 (`npm test` → pass 24, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0개 실패
- 실패 항목: 없음
