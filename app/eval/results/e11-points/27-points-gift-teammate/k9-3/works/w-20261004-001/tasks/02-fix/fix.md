## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json | grep 적립` (또는 `createOrder`로 주문을 만들어 `points.earned` 확인)
- 결과: 재현됨
- 기대: 237P
- 실제: 268P (`amounts.total` 26770 = 상품 28270 − 쿠폰 3000 + 배송비 3000 − 포인트 1500)

## 원인
- 원인: 적립 계산이 배송비가 포함된 결제 금액(`amounts.total`)을 기준으로 했고, 반올림(`percentOf`)을 썼다. 237P는 배송비를 뺀 23770원의 1%(237.7)를 버림한 값이다.
- 근거: `src/points/earn.js:6`이 `amounts.total`에 `percentOf`(반올림, `src/money.js`)를 적용. 수정 실험: 배송비만 빼면 238P, 거기에 버림까지 하면 237P로 기대값과 일치. 배송비가 0인 주문(`test/order.test.js:26`의 O-0002)은 기준 금액이 같아 500P로 변하지 않으므로, 배송비가 붙는 주문만 많게 나오는 현상("조금씩 많게")과 맞는다.
- 사람 추정 판정: 확인 대상은 `src/points/earn.js` — 맞음 — 원인이 그 파일의 계산식에 있음
- 기각한 가설: 적립률(`POINT_RATE_PERCENT`) 설정 오류 — 1%로 정상, 기준 금액과 반올림만 어긋남. 고객센터 계산 기준이 문서로는 없어 "배송비 제외 + 버림"은 237P라는 기대값에서 역산한 것임.

## 변경 요약
- `src/points/earn.js` — 적립 기준을 `total − shipping`으로 바꾸고 원 미만은 버림(`Math.floor`). `percentOf`는 환불 회수에서도 쓰므로 건드리지 않음.
- `test/earn.test.js` — 새 테스트 추가.

## 재현 테스트
- 위치: `test/earn.test.js` (O-1042 237P, 배송비 없는 주문 500P)
- 수정 전: 실패 (`node --test test/earn.test.js` — expected 237, actual 268)
- 수정 후: 통과 (`npm test` 22개 중 22 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 22 통과, 0 실패. `node src/cli.js examples/O-1042.json`의 적립 예정은 237P.
- 실패 항목: 없음
