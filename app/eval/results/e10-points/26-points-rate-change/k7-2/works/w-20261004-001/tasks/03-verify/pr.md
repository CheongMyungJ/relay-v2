# fix: 적립 포인트를 (상품−쿠폰−사용 포인트)의 1%로 계산하고 1P 미만 버림

## 요약
신규 주문의 적립 예정 포인트가 규정과 달랐다. 주문 O-1042가 268P로 나왔으나 규정상 237P다. 적립 계산을 규정대로 고쳤다.

## 원인
`earnPoints`가 배송비가 포함된 결제 금액(26,770원)에 `percentOf`(반올림)를 적용했다. 규정은 배송비를 뺀 (상품 − 쿠폰 − 사용 포인트) 금액의 1%, 1P 미만 버림이다.

## 변경
- `src/points/earn.js`: `goods - coupon - pointsUsed`의 1%를 `Math.floor`로 버림.
- `percentOf`는 선물하기·환불 회수도 쓰므로 바꾸지 않았다. 영수증(`src/format/`)과 이미 적립된 값(`points.earned`)은 그대로다.
- `docs/knowledge/`에 적립 규정 등 지식 3건 추가.
- 범위 밖: 선물하기 적립, 환불 시 포인트 회수는 규정 확인 후 별도로 다룬다.

## 테스트
- `node src/cli.js examples/O-1042.json` → 적립 예정 237P
- `npm test` 24개 통과
- 새 `test/earn.test.js` 4개: 배송비 있음/없음, .5 이상 버림, 쿠폰·포인트 차감
