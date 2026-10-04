# fix: 적립 포인트를 배송비 제외 금액의 1% 내림으로 계산

## 요약
적립 포인트가 많게 나오던 문제를 고쳤다. 적립 기준을 배송비를 뺀 금액(상품 − 쿠폰 − 사용 포인트)의 1% 내림으로 바꿨다. O-1042는 268P에서 237P가 된다.

## 원인
적립 기준이 배송비를 포함한 결제 금액(`amounts.total`)이고 `percentOf`가 반올림이라 배송비가 있는 주문의 적립이 많게 나왔다. 일반 주문과 선물하기 주문이 같은 식을 따로 가지고 있었다.

## 변경
- `src/points/earn.js`: `earnBase` 추가, 기준 금액을 배송비 제외로 바꾸고 내림
- `src/gift/gift-points.js`: `earnPoints`에 위임해 기준을 한 곳에 둠
- `docs/knowledge/point-earn-base-excludes-shipping.md`: 적립 기준 규칙 기록
- 저장된 `points.earned`, `src/format/`, `refund.js`는 바꾸지 않음

## 테스트
- `npm test`: 24개 통과 (새 `test/earn.test.js` 4개 포함)
- `node src/cli.js examples/O-1042.json`: 적립 예정 237P
- G-0213 218P, 무료 배송 주문 339P 확인
- 남은 위험: 부분 환불 회수(`refund.js`)는 상품 금액 1% 반올림이라 새 기준과 어긋날 수 있다 (이번 범위 밖)
