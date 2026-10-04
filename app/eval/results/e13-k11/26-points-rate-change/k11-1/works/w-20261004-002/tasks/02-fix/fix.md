## 재현
- 재현 절차: `createRefund(O-1077, R-0311)`을 실행한다 (`examples/O-1077.json`, `examples/R-0311.json`). 수정 전 코드에서 `test/refund.test.js`의 새 테스트로 확인.
- 결과: 재현됨
- 기대: pointsRecovered 132 (403 − floor(27180×1%)=271)
- 실제: 131 (`percentOf(13130, 1)` 반올림, 환불 금액만 봄)

## 원인
- 원인: `pointsRecovered`를 환불하는 상품 금액의 적립률(반올림)로 계산했다. 저장된 원 적립 포인트와 남은 상품(쿠폰·사용 포인트 반영) 기준 재계산 값의 차이를 쓰지 않았다.
- 근거: `src/orders/refund.js:34` 수정 전 `percentOf(refundGoods, POINT_RATE_PERCENT)`, `src/money.js` `percentOf`는 `Math.round`. 수정 전 새 테스트가 131로 실패, 수정 후 통과.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/money.js — 버림 `floorPercentOf` 추가
- src/orders/refund.js — 회수 = (이전 환불 반영 적립) − floor((남은 상품 − 쿠폰 − 사용 포인트) × 적립률). 첫 환불의 이전 적립은 주문 저장값, 이후 환불은 이전 남은 상품 기준 재계산값(합계가 원 적립 − 최종 재계산이 되도록).
- test/refund.test.js — 테스트 2개 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/refund.test.js 'R-0311은 132P', '나눠 한 부분 환불…'
- 수정 전: 실패 (`npm test`: R-0311 테스트 not ok, 131 ≠ 132; 나눠 한 환불 테스트는 수정 전에도 통과해 변별력이 약함)
- 수정 후: 통과 (`npm test`: 22 pass, 0 fail)

## 테스트 실행
- 명령: npm test
- 결과: 22개 통과, 0 실패
- 실패 항목: 없음
