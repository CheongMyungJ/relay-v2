## 재현
- 재현 절차: `node -e "import('./src/orders/refund.js').then(async m=>{const fs=await import('fs');console.log(m.createRefund(JSON.parse(fs.readFileSync('examples/O-1077.json')),JSON.parse(fs.readFileSync('examples/R-0311.json'))))})"`
- 결과: 재현됨
- 기대: pointsRecovered 132 (403 − 271)
- 실제: pointsRecovered 131, refundAmount 13130

## 원인
- 원인: `createRefund`가 회수 포인트를 환불 상품 금액의 1%를 반올림(`percentOf`)해서 구했다(13,130×1% = 131.3 → 131). 정산팀 식(원래 적립 − 남은 상품 재계산 적립, 버림)과 기준이 달랐다.
- 근거: `src/orders/refund.js` 34행(수정 전) `percentOf(refundGoods, POINT_RATE_PERCENT)`, `src/money.js` `percentOf`는 `Math.round`. 수정 후 같은 명령이 132를 낸다.
- 사람 추정 판정: 없음
- 기각한 가설: 1% 올림(132P) — 사람이 올림이 아니라고 답함(intake). 정산팀 식이 맞음.

## 변경 요약
- src/orders/refund.js — 회수 포인트를 `order.points.earned − floor((remainingGoods − coupon − pointsUsed) × 1%)`로 계산. 더 쓰지 않는 `percentOf` import 제거. `earnPoints`, `refundAmount`, `src/format/`은 바꾸지 않았다.
- test/refund.test.js — O-1077 / R-0311 테스트 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/refund.test.js '부분 환불 회수 포인트: 원래 적립 − 남은 상품 재계산 적립(버림) (O-1077 / R-0311)'
- 수정 전: 실패 (`node --test test/refund.test.js` → expected 132, actual 131)
- 수정 후: 통과 (`npm test` → pass 21, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 21개 통과, 0개 실패
- 실패 항목: 없음
