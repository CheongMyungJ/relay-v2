## 재현
- 재현 절차: `node -e "import('./src/orders/order.js').then(async({createOrder})=>{const fs=await import('fs');console.log(createOrder(JSON.parse(fs.readFileSync('examples/O-1107.json'))).points)})"`
- 결과: 재현됨
- 기대: `points.earned` = 486 (24,330원 × 2% = 486.6 → 486)
- 실제: 273 (기준 커밋: 배송비 포함 total 27,330원 × 1%, 반올림)

## 원인
- 원인: 적립률이 1%이고, `earnPoints`가 배송비를 포함한 `amounts.total`에 반올림(`percentOf`)을 써서 팀 규칙(상품−쿠폰−사용 포인트, 배송비 제외, 버림)과 다르다. 또 `POINT_RATE_PERCENT`를 환불 회수(`refund.js:34`)와 선물하기가 공유해서 상수만 2로 올리면 환불 회수가 바뀐다.
- 근거: `src/points/earn.js:6`, `src/config.js:9`, `src/orders/refund.js:34`. O-1107 goods 27,350 − 쿠폰 2,000 − 포인트 1,020 = 24,330, 배송비 3,000 별도. 수정 전 273, 수정 후 486. O-1077/R-0311 회수는 수정 전후 모두 131.
- 사람 추정 판정: 환불 회수 비율은 이번 변경으로 바뀌면 안 된다 — 맞음. 상수를 공유하므로 분리하지 않으면 131이 262로 바뀐다.
- 기각한 가설: 없음

## 변경 요약
- src/config.js — `POINT_RATE_PERCENT`=2(일반 주문 적립). 환불 회수용 `REFUND_RECOVER_RATE_PERCENT`=1, 선물하기용 `GIFT_POINT_RATE_PERCENT`=1을 분리
- src/points/earn.js — (상품−쿠폰−사용 포인트)×비율/100을 `Math.floor`로 계산(배송비 제외)
- src/orders/refund.js — 환불 회수에 `REFUND_RECOVER_RATE_PERCENT` 사용(동작 불변)
- src/gift/gift-points.js — `GIFT_POINT_RATE_PERCENT` 사용(동작 불변, 배송비 포함·반올림 그대로)
- (기존 테스트 변경) test/order.test.js — '적립 포인트를 주문에 저장한다'의 기대값 500 → 1000 (50,000원 주문, 2% 적용). 검증 대상은 같고 비율 변경만 반영
- test/order.test.js, test/refund.test.js — 새 테스트 추가

## 재현 테스트
- 위치: test/order.test.js (O-1107 → 486), test/refund.test.js (O-1077/R-0311 → 131 유지)
- 수정 전: 실패 (`npm test`: 'O-1107' 테스트 실패 273≠486, 변경한 기존 테스트도 실패. 환불 테스트는 기준에서도 통과하는 회귀 방지용)
- 수정 후: 통과 (`npm test`: pass 22, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0개 실패
- 실패 항목: 없음
