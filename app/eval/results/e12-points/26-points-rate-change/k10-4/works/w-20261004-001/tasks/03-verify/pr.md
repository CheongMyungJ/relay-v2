# fix: 적립 포인트를 배송비 제외, 1P 미만 버림 기준으로 계산

## 요약
적립 예정 포인트가 규정보다 많게 계산되던 버그를 고쳤다. 적립 포인트는 (상품 금액 − 쿠폰 − 사용 포인트)의 1%이고, 1P 미만은 버리며, 배송비는 제외한다. 주문 O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`와 `giftPoints`가 배송비를 포함한 결제 금액(`amounts.total`)에 반올림(`percentOf`)을 적용했다. 환불 회수도 같은 반올림을 썼다. 반올림만 버림으로 바꾸면 O-1042는 267P로 여전히 규정과 다르다.

## 변경
- `src/money.js`: 버림 버전 `percentOfFloor` 추가.
- `src/points/earn.js`: `earnBase`(상품 − 쿠폰 − 사용 포인트) 추가, 적립은 그 금액의 1% 버림.
- `src/gift/gift-points.js`: `earnPoints`에 위임. G-0213은 249P에서 218P가 된다.
- `src/orders/refund.js`: 회수 포인트를 버림으로 계산. R-0311은 131P 그대로다.
- `docs/knowledge/points/earn-rule.md`: 적립 규정과 미정 사항(부분 환불 안분)을 기록.
- 이미 저장된 적립 값과 `src/format/`은 바꾸지 않았다.

## 테스트
- `npm test`: 25개 통과(기존 20 + 신규 5).
- 신규 `test/points-earn.test.js`: 배송비 있는 주문과 무료 배송, 버림, 선물하기, 환불 회수를 확인한다. 수정 전에는 5개 중 4개가 실패한다.
- `node src/cli.js examples/O-1042.json` → 237P, `examples/G-0213.json` → 218P, R-0311 → 131P.
- 남은 위험: 부분 환불의 쿠폰·사용 포인트 안분은 규정이 없어 기존 방식을 유지했다.
