# fix: 적립 포인트 기준에서 배송비를 제외하고 원 단위 버림

## 요약
적립 예정 포인트가 적립 안내보다 많이 나오던 것을 고쳤다. 기준 금액은 상품 − 쿠폰 − 사용 포인트(배송비 제외)이고, 적립률%를 원 단위로 버림한다. O-1042는 268P에서 237P, G-0213은 249P에서 218P가 된다.

## 원인
`earnPoints`와 `giftPoints`가 배송비가 포함된 `amounts.total`에 반올림(`percentOf`)을 적용했다.

## 변경
- `src/points/earn.js`: `earnBase` 추가, 버림 적용
- `src/gift/gift-points.js`: `earnPoints`에 위임해 같은 기준 사용
- `src/money.js`: `percentOfFloor` 추가
- `src/orders/refund.js`: 부분 환불 회수 포인트도 `percentOfFloor` 사용
- `docs/knowledge/points/earn-base-and-rounding.md`: 적립 기준 규칙 기록
- 이미 저장된 주문의 `points.earned` 보정은 하지 않는다

## 테스트
- `npm test`: 25개 통과
- `test/earn.test.js` 추가 (O-1042, 버림, 배송비 제외, G-0213, `percentOfFloor`)
- `node src/cli.js examples/O-1042.json` → 237P, `examples/G-0213.json` → 218P
