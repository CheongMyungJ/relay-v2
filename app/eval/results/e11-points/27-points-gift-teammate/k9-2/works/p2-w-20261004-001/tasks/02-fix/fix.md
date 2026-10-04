## 재현
- 재현 절차: `node -e "import('./src/gift/gift-order.js').then(m=>{const o=JSON.parse(require('fs').readFileSync('examples/G-0213.json'));console.log(m.createGiftOrder(o).points)})"`
- 결과: 재현됨
- 기대: 218P (floor((24,860 − 3,000) × 1%))
- 실제: `{ used: 1000, earned: 249 }`

## 원인
- 원인: `giftPoints`가 일반 주문의 `earnPoints`를 쓰지 않고 `percentOf(total, 1%)`로 배송비가 든 총액을 반올림해 계산했다.
- 근거: `src/gift/gift-points.js`의 기존 구현. G-0213은 total 24,860 → 249, 배송비 3,000을 빼면 21,860 → 218. 일반 주문은 `src/orders/order.js:35`에서 `earnPoints`를 쓴다. 수정 후 249가 218로 바뀌는 것을 테스트로 확인함.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — `giftPoints`가 `earnPoints`에 위임하도록 바꿔 일반 주문과 같은 규칙(배송비 제외, 1% 내림)을 쓴다.
- test/gift.test.js — G-0213이 218P이고 같은 상품의 일반 주문 적립과 같음을 확인하는 테스트 추가(기존 테스트는 변경 없음).

## 재현 테스트
- 위치: test/gift.test.js 마지막 테스트 (G-0213 적립 포인트)
- 수정 전: 실패 (`node --test test/gift.test.js` → expected 218, actual 249, fail 1)
- 수정 후: 통과 (`npm test` → 24개 중 24개 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: tests 24, pass 24, fail 0
- 실패 항목: 없음
