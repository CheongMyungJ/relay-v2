# payments

주문 결제 금액, 포인트 적립, 할부, PG사 결제 요청을 계산하는 모듈이다.

- `src/order.js`: 주문 금액(상품 합계, 배송비)
- `src/points.js`: 회원 등급별 포인트 적립
- `src/installment.js`: 카드 할부 수수료
- `src/pg.js`: PG사 결제 요청 만들기와 보내기(시험에서는 가짜 PG)
- `src/cli.js`: `node src/cli.js examples/O-1001.json` 처럼 주문 파일로 금액을 찍어 본다

시험: `npm test`
