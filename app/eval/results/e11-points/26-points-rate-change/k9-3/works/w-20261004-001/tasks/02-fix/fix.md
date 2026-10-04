## 재현
- 재현 절차: 기준 커밋에서 `node -e "import('./src/orders/order.js').then(m=>console.log(m.createOrder(JSON.parse(require('fs').readFileSync('examples/O-1042.json'))).points.earned))"` (또는 새 테스트 `node --test test/earn.test.js`)
- 결과: 재현됨
- 기대: 237P
- 실제: 268P (결제 금액 26,770 = 상품 28,270 − 쿠폰 3,000 + 배송비 3,000 − 사용 포인트 1,500 의 1%)

## 원인
- 원인: 적립 기준이 `amounts.total`(배송비 포함, 사용 포인트는 차감)이라 배송비가 적립에 들어갔고, `percentOf`가 반올림이라 끝수를 올렸다. 선물(`gift-points.js`)과 부분 환불 회수(`refund.js`)도 같은 방식이었다. 환불은 환불 상품 금액만 반올림해 회수해서 쿠폰·사용 포인트가 반영되지 않았다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:46`(수정 전). 기준 커밋에서 새 테스트 5개 실패, 수정 후 통과. 배송비가 있는 주문은 배송비만큼, 배송비 없고 쿠폰·포인트도 없는 주문은 끝수 반올림 때만 차이가 나서 "조금씩 많다"는 증상과 맞는다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/money.js — 버림 퍼센트 계산 `floorPercentOf` 추가
- src/points/earn.js — 적립 기준 `earnBase`/`earnFromAmounts` 추가, `earnPoints`가 (상품−쿠폰−사용 포인트)의 1% 버림을 쓴다
- src/gift/gift-points.js — `earnPoints`와 같은 기준을 쓴다
- src/orders/refund.js — 부분 환불 회수 = 환불 전 남은 주문 적립분 − 환불 뒤 남은 주문 적립분. 여러 번 환불한 합이 적립분과 맞는다. 전체 취소는 저장된 `points.earned`를 그대로 회수(변경 없음)
- 기존 테스트 변경 없음, `src/format/` 변경 없음, 저장된 `points.earned` 재계산 코드 없음

## 재현 테스트
- 위치: test/earn.test.js (O-1042 237P, 배송비, 끝수 버림, G-0213 218P, 부분 환불 회수)
- 수정 전: 실패 (`git checkout 2e94d09 -- src` 뒤 `npm test` → 5개 실패, 20 통과)
- 수정 후: 통과 (`npm test` → 25 통과, 0 실패)

## 테스트 실행
- 명령: npm test
- 결과: 25개 통과, 0개 실패
- 실패 항목: 없음
