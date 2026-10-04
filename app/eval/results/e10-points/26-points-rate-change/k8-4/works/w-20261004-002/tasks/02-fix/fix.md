## 재현
- 재현 절차: `node src/cli.js examples/R-0311.json --order examples/O-1077.json`
- 결과: 재현됨
- 기대: 포인트 회수 132P (요청의 정산팀 값)
- 실제: 131P (환불 금액 13,130원은 정상)

## 원인
- 원인: `createRefund`가 환불 상품 금액(13,130)에 적립률을 곱해 반올림(131.3→131)했다. 쿠폰·사용 포인트가 남은 주문에 그대로 남는데도 이를 반영하지 않아, 남은 주문 적립분의 감소량과 어긋났다.
- 근거: 수정 전 `src/orders/refund.js:34` `percentOf(refundGoods, POINT_RATE_PERCENT)`. O-1077은 환불 전 기준 40,310 → 403P, 환불 뒤 기준 27,180 → 271P(버림), 차이 132P. 환불 금액에 직접 곱하면 131P. 코드를 고쳐 132P가 나오는 것을 확인함. 쿠폰·사용 포인트가 없는 기존 테스트(100P)는 두 방식이 같아 드러나지 않았다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/orders/refund.js — 회수 = (환불 전 남은 주문 적립분) − (환불 뒤 남은 주문 적립분)으로 변경. 적립 기준은 상품 − 쿠폰 − 사용 포인트(배송비 제외), 소수점 버림(팀 지식 earn-rule.md). `refundAmount`, `cancelOrder`, `earnPoints`는 그대로.
- test/refund.test.js — 테스트 2개 추가 (기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/refund.test.js (R-0311 = 132P, 나눠 환불한 합 132P)
- 수정 전: 실패 (`node --test test/refund.test.js` → expected 132, actual 131)
- 수정 후: 통과 (같은 명령, fail 0)
- 참고: 나눠 환불하는 테스트는 수정 전에도 통과한다(우연히 합이 같음). 회귀 방지용이다.

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0 실패
- 실패 항목: 없음
