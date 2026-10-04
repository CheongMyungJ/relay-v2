## 재현
- 재현 절차: 저장소 루트에서 `node -e "import('./src/orders/order.js').then(m=>{const o=m.createOrder(JSON.parse(require('fs').readFileSync('examples/O-1107.json')));console.log(o.points)})"`
- 결과: 재현됨
- 기대: `points.earned` = 486 (24,330원 × 2%, 버림, 배송비 제외)
- 실제: 273 (배송비 포함 total 27,330 × 1%, 반올림). 값만 2로 올리면 547이라 여전히 어긋남

## 원인
- 원인: 적립률이 1%이고, 적립 계산이 배송비가 든 `amounts.total`에 반올림(`percentOf`)을 써서 팀 규칙(배송비 제외, 버림)과 다르다. 선물하기(`giftPoints`)도 따로 같은 식을 복제했다. 환불 회수(`refund.js`)가 `POINT_RATE_PERCENT`를 공유해 값을 올리면 함께 바뀐다.
- 근거: `src/points/earn.js`, `src/gift/gift-points.js`, `src/orders/refund.js:34`, `src/config.js:9`. O-1107 실행 결과 273. 수정 뒤 486, 환불 테스트 통과.
- 사람 추정 판정: 없음
- 기각한 가설: 적립률 값만 2로 바꾸면 된다 — total(27,330)×2% 반올림 = 547로 기대값 486과 다름

## 변경 요약
- src/config.js — `POINT_RATE_PERCENT`를 2로, 환불 회수용 `REFUND_RECOVER_RATE_PERCENT = 1` 추가
- src/points/earn.js — (상품 − 쿠폰 − 사용 포인트) × 비율, 버림
- src/gift/gift-points.js — `earnPoints`에 위임해 한 곳으로 모음
- src/orders/refund.js — 회수 비율을 새 상수(1)로 분리해 계산 결과를 변경 전과 같게 유지
- (기존 테스트 변경) test/order.test.js — 적립 기대값 500→1000 (2% 정책 반영)
- (기존 테스트 변경) test/gift.test.js — 적립 기대값 300→600 (2% 정책 반영)

## 재현 테스트
- 위치: test/earn.test.js
- 수정 전: 실패 (`node --test test/earn.test.js` → pass 0, fail 3)
- 수정 후: 통과 (`npm test` → pass 23, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 23 통과, 0 실패
- 실패 항목: 없음
