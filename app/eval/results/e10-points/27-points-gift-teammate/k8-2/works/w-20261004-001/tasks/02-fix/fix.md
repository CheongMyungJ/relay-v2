## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P
- 실제: 268P (결제 금액 26,770원의 1%를 반올림)

## 원인
- 원인: `earnPoints`가 배송비가 포함된 결제 금액(`amounts.total`)에 `percentOf`(반올림)를 써서 적립 기준보다 많게 나온다. 적립 기준은 배송비를 뺀 금액을 내림한 값이다.
- 근거: `src/points/earn.js`가 `percentOf(order.amounts.total, 1)`을 쓴다. O-1042는 26,770 → 267.7 → 268. 배송비 3,000원을 빼면 23,770 → 237.7이고, 237이 되려면 반올림이 아니라 내림이어야 한다. 고친 뒤 237P가 나오는 것을 확인했다. 배송비가 0인 주문(O-1077 등)은 배송비 제외의 영향이 없고 내림만 차이가 나며, 같은 코드 경로다.
- 사람 추정 판정: 없음
- 기각한 가설: 쿠폰 할인 전 금액(상품 금액 기준) 적립 — 28,270 → 282로 237과 맞지 않음. 쿠폰 후 금액에서 포인트 사용도 빼지 않는 경우(25,270 → 252)도 맞지 않음.

## 변경 요약
- src/points/earn.js — 적립 기준을 `total - shipping`으로 하고 `Math.floor`로 내림. `src/money.js`는 건드리지 않고 이 파일 안에서 처리함.
- test/earn.test.js — 새 파일(재현 테스트)

## 재현 테스트
- 위치: test/earn.test.js
- 수정 전: 실패 (`node --test test/earn.test.js` — expected 237, actual 268)
- 수정 후: 통과 (`node --test test/earn.test.js` — pass 2, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0개 실패. `node src/cli.js examples/O-1042.json`은 237P.
- 실패 항목: 없음
