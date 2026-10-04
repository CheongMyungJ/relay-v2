## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json | grep 적립`
- 결과: 재현됨
- 기대: 237P
- 실제: 268P

## 원인
- 원인: `src/points/earn.js`가 `order.amounts.total`(배송비 포함, 사용 포인트 차감)의 1%를 반올림해 적립 포인트를 구했다. 고객센터 기준은 배송비를 뺀 `상품 − 쿠폰 − 사용 포인트`의 1%를 내림한 값이다.
- 근거: O-1042는 상품 28,270, 쿠폰 3,000, 배송비 3,000, 사용 포인트 1,500, total 26,770이고, 26,770의 1%는 268P(src/points/earn.js:5). 23,770(상품−쿠폰−포인트)의 1%는 237.7인데 기대값이 237이라 내림이다. 다른 조합(배송비만 제외 253, 포인트만 제외 283)은 237과 맞지 않는다. 수정 후 237P가 나온다(실험함).
- 사람 추정 판정: 원인이 `src/points/earn.js` 쪽 — 맞음 — 계산식이 그 파일에 있고 거기를 고쳐 해결됐다.
- 기각한 가설: `percentOf`(src/money.js) 공용 함수를 고친다 — 선물하기 적립과 환불 회수도 쓰고, 선물하기는 변경 금지라 기각. 계산을 `earn.js`에 두었다.

## 변경 요약
- src/points/earn.js — 적립 기준을 `goods − coupon − pointsUsed`로 바꾸고 원 단위 내림으로 계산.
- test/order.test.js — 재현 테스트 추가(기존 테스트는 바꾸지 않음).

## 재현 테스트
- 위치: test/order.test.js ('적립 포인트는 배송비를 뺀 금액에서 ... (O-1042)')
- 수정 전: 실패 (`node --test test/order.test.js` — expected 237, actual 268)
- 수정 후: 통과 (`npm test` — pass 21, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 21개 통과, 0개 실패
- 실패 항목: 없음
