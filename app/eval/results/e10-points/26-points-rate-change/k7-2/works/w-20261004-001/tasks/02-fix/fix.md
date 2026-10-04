## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P
- 실제: 268P

## 원인
- 원인: `earnPoints`가 배송비가 포함된 결제 금액(`amounts.total` = 26,770원)에 `percentOf`(반올림)를 적용했다. 규정은 배송비를 뺀 금액(23,770원)의 1%, 버림이다.
- 근거: `src/points/earn.js`의 `percentOf(order.amounts.total, ...)`. 26,770 × 1% = 267.7 → 반올림 268P. 규정대로면 23,770 → 237.7 → 237P. 수정 후 CLI가 237P를 출력함. 배송비가 없는 주문은 total과 (상품−쿠폰−포인트)가 같아 배송비 때문에 어긋나지 않고, 소수 .5 이상일 때만 반올림 차이가 난다.
- 사람 추정 판정: 없음
- 기각한 가설: `percentOf` 자체를 버림으로 바꾸기 — 선물하기(`gift-points.js`)와 환불 회수(`refund.js`)도 쓰므로 비목표를 건드린다. `earn.js`만 고쳤다.

## 변경 요약
- src/points/earn.js — 적립 금액을 `goods - coupon - pointsUsed`로 계산하고 `Math.floor`로 버림. `money.js`의 `percentOf`는 그대로 둠.
- test/earn.test.js — 새 테스트 파일(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/earn.test.js (4개)
- 수정 전: 실패 — `node --test test/earn.test.js` → pass 2 / fail 2 (배송비 있는 주문, O-1042 버림)
- 수정 후: 통과 — 같은 명령 → pass 4 / fail 0

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0개 실패
- 실패 항목: 없음
