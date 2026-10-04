# fix: 적립 포인트를 배송비 제외 기준, 원 단위 버림으로 계산

## 요약
주문의 적립 예정 포인트가 적립 안내보다 많게 나오던 버그를 고쳤다. O-1042는 268P → 237P.

## 원인
`earnPoints`와 `giftPoints`가 배송비가 포함된 결제 금액(`amounts.total`)에 반올림(`percentOf`)을 적용했다. 기준 금액과 반올림 규칙이 모두 틀렸다.

## 변경
- `src/points/earn.js`: 기준 `earnBase`(상품 − 쿠폰 − 사용 포인트)와 버림으로 계산
- `src/money.js`: `percentOfFloor` 추가
- `src/gift/gift-points.js`: `earnPoints`에 위임
- `src/orders/refund.js`: 부분 환불 회수 포인트도 버림으로 계산(적립보다 많이 회수되던 문제)
- `docs/knowledge/points/earn-points-rule.md`: 적립 규칙 기록
- 과거 저장 주문은 보정하지 않음

## 테스트
- `npm test`: 25개 통과
- `node src/cli.js examples/O-1042.json` → 적립 예정 237P
- `test/earn.test.js`: O-1042, 배송비 유/무, 버림, 선물하기, 환불 회수
