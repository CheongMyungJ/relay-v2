## 재현
- 재현 절차: `node src/cli.js examples/R-0311.json --order examples/O-1077.json`
- 결과: 재현됨
- 기대: 포인트 회수 -132P (403 − floor(27,180×1%)=271)
- 실제: 포인트 회수 -131P (환불 상품 13,130원의 1%를 반올림)

## 원인
- 원인: `createRefund`가 `pointsRecovered`를 환불 상품 금액의 1% 반올림(`percentOf(refundGoods, 1)`)으로 계산해, 저장된 원래 적립과 남은 상품 기준 재계산 적립의 차이와 어긋난다.
- 근거: `src/orders/refund.js`의 기존 `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)`, `src/money.js` `percentOf`는 `Math.round`. 수정 전 CLI 출력 -131P, 수정 후 -132P. 환불 금액이 클수록 반올림·쿠폰·사용 포인트·원 적립 기준 차이가 1~2P로 나타난다. 기존 테스트(쿠폰·포인트 사용 없음, 500 − 400 = 100)는 우연히 일치해 통과했다.
- 사람 추정 판정: 없음 (사람의 추정이 아니라 규칙 지정만 있었고 코드와 일치함)
- 기각한 가설: 없음

## 변경 요약
- `src/money.js` — 버림 방식 `floorPercentOf` 추가
- `src/orders/refund.js` — `pointsRecovered = max(0, order.points.earned − floor((remainingGoods − 쿠폰 − 사용 포인트) × 1%))`. `remainingGoods`는 이전 환불분(`alreadyRefunded`)을 이미 반영한다. `refundAmount`는 그대로.
- `test/refund.test.js` — 테스트 2개 추가(기존 테스트는 변경 없음)

## 재현 테스트
- 위치: `test/refund.test.js` ('O-1077/R-0311', 'alreadyRefunded' 두 건)
- 수정 전: 실패 — `src`만 되돌리고 `npm test` 실행: pass 20, fail 2
- 수정 후: 통과 — `npm test`: tests 22, pass 22, fail 0

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 모두 통과
- 실패 항목: 없음
