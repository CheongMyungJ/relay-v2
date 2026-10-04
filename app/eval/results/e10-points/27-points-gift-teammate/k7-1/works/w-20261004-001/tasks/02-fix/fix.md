## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P (기준 금액 23,770원)
- 실제: 적립 예정 268P

## 원인
- 원인: `earnPoints`가 배송비가 포함된 `amounts.total`(26,770원)에 반올림 `percentOf`를 써서 안내 기준보다 많이 나온다.
- 근거: `src/points/earn.js`(수정 전)가 `percentOf(order.amounts.total, ...)`를 썼다. `total = goods − coupon + shipping − pointsUsed`(`src/orders/order.js:19`). 26,770 × 1% = 267.7 → 반올림 268. 수정 후 같은 명령이 237P를 출력한다. 배송비가 없는 주문(`test/order.test.js` O-0002, 50,000원 → 500P)은 원래도 맞았고 수정 뒤에도 같다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- `src/points/earn.js` — 기준 금액을 `goods − coupon − pointsUsed`(배송비 제외)로 하고 `Math.floor`로 원 단위 버림.
- `test/earn.test.js`(신규) — 배송비 제외, 소수점 버림, O-1042 237P 확인.

## 재현 테스트
- 위치: `test/earn.test.js`
- 수정 전: 실패 (`earn.js`만 원복하고 `node --test test/earn.test.js` → pass 0, fail 3)
- 수정 후: 통과 (같은 명령 → 3개 모두 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 23개 통과, 0개 실패 (기존 20개 + 신규 3개)
- 실패 항목: 없음
