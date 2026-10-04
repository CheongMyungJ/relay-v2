## 재현
- 재현 절차: `node -e "import('./src/orders/order.js').then(async m=>{const fs=await import('node:fs');console.log(m.createOrder(JSON.parse(fs.readFileSync('examples/O-1042.json'))).points.earned)})"`
- 결과: 재현됨
- 기대: 237
- 실제: 268 (total 26,770 = 배송비 3,000 포함, 반올림)

## 원인
- 원인: 적립 계산이 배송비가 포함된 `amounts.total`에 반올림(`percentOf`)을 적용했다. 선물하기(`gift-points.js`)와 부분 환불 회수(`refund.js`)도 같은 반올림 `percentOf`를 썼다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`. 수정 전 테스트 4건이 실패하고 수정 후 통과했다(실험 확인).
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- `src/money.js` — 버림 도우미 `floorPercentOf` 추가. `percentOf`는 다른 곳에서 쓸 수 있어 그대로 둠
- `src/points/earn.js` — 적립 기준을 상품 − 쿠폰 − 사용 포인트로 바꾸고 버림 적용(`earnBase` 추가)
- `src/gift/gift-points.js` — `earnPoints`에 위임해 일반 주문과 같은 기준
- `src/orders/refund.js` — 부분 환불 회수를 `floorPercentOf(refundGoods)`로 변경. 전체 취소는 저장된 `points.earned` 그대로(변경 없음)
- `test/earn.test.js` — 새 테스트 파일

## 재현 테스트
- 위치: `test/earn.test.js`
- 수정 전: 실패 (`src`를 되돌리고 `npm test`: 4건 실패)
- 수정 후: 통과 (`npm test`: 24 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 24 pass, 0 fail
- 실패 항목: 없음
