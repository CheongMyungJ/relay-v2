## 재현
- 재현 절차: `node -e "import('./src/orders/order.js').then(m=>console.log(m.createOrder(JSON.parse(require('fs').readFileSync('examples/O-1042.json'))).points.earned))"` 또는 `node src/cli.js examples/O-1042.json`의 "적립 예정" 줄
- 결과: 재현됨
- 기대: 237P
- 실제: 268P

## 원인
- 원인: `earnPoints`가 배송비가 포함된 결제 금액(`amounts.total`)에 1%를 걸고 반올림(`percentOf`)한다. 고객센터 기준은 배송비를 뺀 금액의 1%를 내림한 값이다.
- 근거: `src/points/earn.js`(수정 전)는 `percentOf(order.amounts.total, 1)`. O-1042는 total 26,770(배송비 3,000 포함) → 267.7 → 반올림 268. 배송비를 빼면 23,770 → 237.7이고, 237이 되려면 내림이어야 한다(반올림이면 238). 배송비 제외와 내림 두 조건이 모두 있어야 237이 나오고, 다른 조합(총액 내림 267, 쿠폰까지 제외한 상품 금액 252)은 237과 맞지 않는다. 배송비가 0인 기존 테스트(50,000원 → 500P)는 영향이 없다. 수정 후 O-1042가 237로 나오는 것을 실험으로 확인했다.
- 사람 추정 판정: 문제는 `src/points/earn.js` 쪽 — 맞음 — 위 근거대로 이 파일의 계산이 원인이다.
- 기각한 가설: 총액 기준 내림만 바꾸면 된다 — 267로 237과 다름. 상품 금액에서 쿠폰만 빼고 포인트 사용액은 안 뺀다 — 252로 다름.

## 변경 요약
- `src/points/earn.js` — 적립 기준을 `total - shipping`으로 바꾸고 `Math.floor`로 내림
- `test/earn.test.js` (새 파일) — O-1042 237P, O-1107 243P, 배송비 없는 주문 500P

## 재현 테스트
- 위치: `test/earn.test.js`
- 수정 전: 실패 (`npm test` → O-1042, O-1107 테스트 2건 not ok, pass 21 / fail 2)
- 수정 후: 통과 (`npm test` → pass 23 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 23개 통과, 0개 실패
- 실패 항목: 없음
