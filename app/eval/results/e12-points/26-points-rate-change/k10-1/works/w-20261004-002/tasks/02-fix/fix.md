## 재현
- 재현 절차: `node -e "import('./src/orders/refund.js').then(async m=>{const fs=await import('fs');console.log(m.createRefund(JSON.parse(fs.readFileSync('examples/O-1077.json')),JSON.parse(fs.readFileSync('examples/R-0311.json'))))})"`
- 결과: 재현됨
- 기대: `pointsRecovered` 132 (403 − 271)
- 실제: 131

## 원인
- 원인: `createRefund`가 회수 포인트를 환불 상품 금액의 1% 반올림(`percentOf(13130, 1)` = 131)으로 계산했다. 쿠폰·사용 포인트를 반영한 남은 주문의 재계산 적립(버림)과 달라 1~2P 어긋난다.
- 근거: `src/orders/refund.js` 수정 전 `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)`. 재현 출력 131. 수정 후 같은 명령에서 132, 재현 테스트가 수정 전 실패·수정 후 통과.
- 사람 추정 판정: 정산팀 연락(회수 131P, 정산팀 132P) — 맞음 — 현재 코드가 131을 내고 정산팀 식은 403 − 271 = 132
- 기각한 가설: 환불 상품 금액의 1% 버림 — 13130×1% = 131.3 → 131이라 132와 다름 (intake에서 기각)

## 변경 요약
- src/orders/refund.js — 회수 = 원래 적립(`points.earned`) − `earnOnRemaining`(남은 상품 − 쿠폰 − 사용 포인트의 1%, 버림, 배송비 제외). 이전 환불(`alreadyRefunded`)이 있으면 중복 회수를 막으려 "원래 적립" 자리에 이번 환불 직전 남은 상품의 재계산 적립을 쓴다.
- test/refund.test.js — 테스트 2개 추가 (기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/refund.test.js 의 '부분 환불 회수: ...' 2개
- 수정 전: 실패 (`npm test` → 21, 22번 실패, 21번은 expected 132 actual 131)
- 수정 후: 통과 (`npm test` → 22 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0 실패
- 실패 항목: 없음
