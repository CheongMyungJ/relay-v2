## 재현
- 재현 절차: `node -e "import('./src/orders/refund.js').then(async m=>{const fs=await import('fs');console.log(m.createRefund(JSON.parse(fs.readFileSync('examples/O-1077.json')),JSON.parse(fs.readFileSync('examples/R-0311.json'))))})"`
- 결과: 재현됨
- 기대: `pointsRecovered` 132 (403 − 271)
- 실제: 131

## 원인
- 원인: `createRefund`가 회수 포인트를 환불 상품 금액의 1%를 반올림(`percentOf`)해 구했다. 적립 규정(쿠폰·사용 포인트 차감 후 1%, 버림)과 달라 쿠폰·사용 포인트가 있거나 반올림이 갈리는 주문에서 1~2P 어긋난다.
- 근거: `src/orders/refund.js:34` (수정 전). O-1077: 13,130 × 1% = 131.3 → 131. 규정대로는 403 − floor(27,180 × 1%) = 132. 수정 후 재현 명령이 132를 낸다. 쿠폰·사용 포인트가 없고 딱 떨어지는 기존 테스트(O-0100)는 두 방식이 같아 통과했다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/orders/refund.js — 회수 포인트를 `order.points.earned − remainingEarn(...)`로 계산. `remainingEarn`은 (남은 상품 − 쿠폰 − 사용 포인트)의 1%를 버림. `earn.js`, `cancelOrder`, `refundAmount`는 건드리지 않았다. 이전 부분 환불(alreadyRefunded)은 남은 상품 금액에 이미 반영된다.
- test/refund.test.js — O-1077/R-0311 회수 포인트 132 테스트 추가 (기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/refund.test.js 마지막 테스트
- 수정 전: 실패 (`npm test` → 20 pass, 1 fail, 131 ≠ 132)
- 수정 후: 통과 (`npm test` → 21 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 21 통과, 0 실패
- 실패 항목: 없음
