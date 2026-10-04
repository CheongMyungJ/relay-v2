## 재현
- 재현 절차: `node -e "import('./src/index.js').then(async m=>{const fs=await import('fs');const o=m.createOrder(JSON.parse(fs.readFileSync('examples/O-1107.json')));console.log(o.points)})"`
- 결과: 재현됨
- 기대: `earned` 486 (24,330원 × 2% = 486.6 → 486P)
- 실제: `earned` 273 (총액 27,330원(배송비 포함) × 1%, 반올림)

## 원인
- 원인: 적립률 상수가 1이고, `earnPoints`가 규정과 달리 배송비가 든 결제 금액(`amounts.total`)에 반올림(`percentOf`)을 쓴다. 환불 회수와 선물하기도 같은 상수를 써서 상수만 바꾸면 이 둘도 2%가 된다.
- 근거: `src/config.js:9`, `src/points/earn.js:6`, `src/orders/refund.js:34`, `src/gift/gift-points.js:6`. 수정 전 O-1107 = 273 출력. 수정 뒤 486, 환불·선물하기 테스트 결과 변동 없음.
- 사람 추정 판정: 없음 (고객센터 486P는 맞음 — 규정으로 다시 계산해도 486P)
- 기각한 가설: 상수만 2로 바꾼다 — 배송비 포함·반올림 때문에 O-1107이 547P가 되고, 환불·선물하기도 2%가 됨

## 변경 요약
- `src/config.js` — `POINT_RATE_PERCENT`를 2로. 환불 회수용 `REFUND_RECOVER_RATE_PERCENT`, 선물하기용 `GIFT_POINT_RATE_PERCENT`를 1로 분리(비목표 유지)
- `src/points/earn.js` — (상품 금액 - 쿠폰 - 사용 포인트) × 적립률을 1P 미만 내림으로 계산
- `src/orders/refund.js`, `src/gift/gift-points.js` — 분리한 상수를 써서 지금 동작(1%, 반올림) 유지
- (기존 테스트 변경) `test/order.test.js` '적립 포인트를 주문에 저장한다' — 기대값 500 → 1000 (상품 50,000원, 쿠폰 없음의 2%라 비율 변경의 직접 결과)

## 재현 테스트
- 위치: `test/order.test.js` 'O-1107' 테스트
- 수정 전: 실패 (`git checkout -- src` 뒤 `npm test`: 2건 실패, 새 테스트 포함)
- 수정 후: 통과 (`npm test`: 21 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 21 pass, 0 fail
- 실패 항목: 없음
