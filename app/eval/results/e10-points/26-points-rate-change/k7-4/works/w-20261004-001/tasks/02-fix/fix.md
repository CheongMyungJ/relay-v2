## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P
- 실제: 268P (수정 전)

## 원인
- 원인: `earnPoints`가 배송비가 포함된 `amounts.total`(26,770)에 반올림(`percentOf`)을 적용했다. 기준액은 23,770이어야 하고 버림이어야 한다.
- 근거: `src/points/earn.js:6`, `src/orders/order.js:15`(total에 배송비 포함), `src/money.js` percentOf는 Math.round. 수정 전 earn 테스트가 237 기대에 268, 100 기대에 130으로 실패. 수정 뒤 237P.
- 사람 추정 판정: 추가 의견(237P 식은 안내 문서가 아니라 숫자에 맞춰 고른 것) — 판단 불가. 안내 문서를 확인하지 못했다. 237P와 맞는 후보는 intent대로 하나뿐이다.
- 기각한 가설: 배송비 제외 + 반올림 — 238P라 안내와 맞지 않음(intake 기각).

## 환불 정합성 확인
- 환불 회수(`src/orders/refund.js:34`)는 환불 상품 금액의 1%를 반올림했다. 적립은 버림이라, 나눠서 부분 환불하면 회수 합계가 적립보다 커질 수 있다(예: 50원짜리 4개, 적립 2P, 1개씩 환불하면 1P×4 = 4P 회수). 어긋남을 확인해 버림으로 맞췄다.
- 환불 기준액(상품 금액)은 적립 기준(상품 − 쿠폰 − 포인트)보다 크거나 같고, 환불 합계는 남은 금액 검사로 적립 기준액 이하로 제한된다. 각 환불을 버림하면 합계가 적립을 넘지 않는다. 쿠폰·포인트를 쓴 주문에서는 회수가 적립 비례보다 조금 많을 수 있으나 적립을 넘지는 않는다.

## 변경 요약
- src/points/earn.js — 적립 기준을 상품 − 쿠폰 − 사용 포인트(배송비 제외)로, 버림으로 변경
- src/money.js — `floorPercentOf` 추가(`percentOf`는 선물 적립 등이 쓰므로 그대로)
- src/orders/refund.js — 포인트 회수를 `floorPercentOf`로 변경
- test/earn.test.js, test/refund.test.js — 새 테스트 추가(기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/earn.test.js, test/refund.test.js(마지막 두 테스트)
- 수정 전: 실패 (`node --test test/earn.test.js` → 237 기대에 268, `# fail 2`. 환불 테스트 2개도 실패, 전체 `# fail 2`)
- 수정 후: 통과 (`npm test` → `# pass 24`, `# fail 0`)

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0 실패
- 실패 항목: 없음
