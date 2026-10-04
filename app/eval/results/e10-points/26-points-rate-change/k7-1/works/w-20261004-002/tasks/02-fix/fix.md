## 재현
- 재현 절차: `node src/cli.js examples/R-0311.json --order examples/O-1077.json`
- 결과: 재현됨
- 기대: 포인트 회수 132P
- 실제: 포인트 회수 131P (환불 금액 13,130원)

## 원인
- 원인: `createRefund`가 환불 상품 금액에 적립률을 바로 곱해 반올림(`percentOf(13130, 1)` = 131)한다. 적립은 (상품 − 쿠폰 − 사용 포인트) 기준 금액을 버림하는데(403P), 회수는 다른 기준·다른 반올림이라 어긋난다.
- 근거: `src/orders/refund.js` 마지막 return의 `pointsRecovered`. 환불 전 기준 40,310원 → 403P, 환불 후 27,180원 → 271P, 차이 132P. 수정 뒤 CLI가 132P를 출력하고, 수정 전 실패하던 테스트가 통과한다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/points/earn.js — 적립 기준 금액을 받아 버림하는 `earnOn(base)` 추가. 이 브랜치에는 없어서 추가했다(앞 Work에서 같은 이름으로 고쳤을 수 있음). `earnPoints`는 건드리지 않았다.
- src/orders/refund.js — 회수를 `earnOn(환불 전 기준) − earnOn(환불 후 기준)`으로 계산하고 `order.points.earned`를 넘지 않게 했다. `refundAmount`는 그대로다.
- test/refund.test.js — 테스트 3개 추가(기존 테스트는 변경 없음).

## 재현 테스트
- 위치: test/refund.test.js (O-1077 R-0311 = 132P, 나눠 환불한 합, 적립 초과 방지)
- 수정 전: 실패 (`npm test` → 2건 실패: 132P 기대에 131P, 상한 100P 기대에 초과 값)
- 수정 후: 통과 (`npm test` → 23 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 23 pass, 0 fail
- 실패 항목: 없음
