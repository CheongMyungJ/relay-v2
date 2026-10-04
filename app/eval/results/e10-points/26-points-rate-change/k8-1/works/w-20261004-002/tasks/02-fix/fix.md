## 재현
- 재현 절차: 워크트리에서 `node -e "import('./src/orders/refund.js').then(async m=>{const fs=await import('fs');const o=JSON.parse(fs.readFileSync('examples/O-1077.json'));const r=JSON.parse(fs.readFileSync('examples/R-0311.json'));console.log(m.createRefund(o,r).pointsRecovered)})"`
- 결과: 재현됨
- 기대: 132P
- 실제: 131P

## 원인
- 원인: `createRefund`가 회수 포인트를 환불 상품 금액(13,130)의 1% 반올림(131)으로 계산했다. 쿠폰·사용 포인트가 남은 주문에 그대로 남는 것을 반영하지 않아, 남은 주문의 적립액 차이로 계산하는 정산 방식과 어긋난다.
- 근거: `src/orders/refund.js`의 옛 `percentOf(refundGoods, POINT_RATE_PERCENT)`. O-1077: 적립 403, 남은 주문 base = 34,180−5,000−2,000 = 27,180 → 1% 버림 271, 403−271 = 132. 수정 후 R-0311이 132로 나옴(재현 테스트). 건마다 반올림하면 합계 오차도 생긴다.
- 사람 추정 판정: 없음
- 기각한 가설: 남은 주문 적립을 기존 `earnPoints` 방식(반올림)으로 계산 — 27,180의 1%는 271.8 → 272, 차이 131이라 132가 안 나옴. 버림이어야 팀 지식(earn-rule)·정산 값과 맞음.

## 변경 요약
- src/orders/refund.js — `remainingEarn` 추가(남은 상품−쿠폰−사용 포인트의 1%, 1P 미만 버림, 저장된 적립액 이하로 제한). 회수 = 환불 전 남은 적립 − 환불 후 남은 적립. `refundAmount`, `cancelOrder`, `src/format/`은 그대로.
- test/refund.test.js — 테스트 2개 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/refund.test.js (O-1077/R-0311 = 132P, 다회 환불 합계 ≤ 적립액)
- 수정 전: 실패 (`npm test` → `131 !== 132`)
- 수정 후: 통과 (`npm test` → pass 22, fail 0)
- 다회 환불 합계 테스트는 수정 전에도 통과한다(가드 용도). 합계 상한은 telescoping과 적립액 상한으로 보장된다.

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0개 실패
- 실패 항목: 없음
