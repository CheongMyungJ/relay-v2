# fix: 적립 포인트를 차감 후 상품 금액 기준 버림으로 계산하고 환불 회수도 맞춤

## 요약
일반 주문의 적립 예정 포인트와 부분 환불 회수 포인트를 고객센터 적립 안내 기준에 맞췄다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비를 더하고 포인트를 뺀 결제 금액에 반올림 `percentOf`를 적용했다. 부분 환불 회수도 반올림이라 같은 식으로 어긋났다.

## 변경
- `src/points/earn.js`: (상품 − 쿠폰 − 사용 포인트)의 적립률%, 버림. 배송비 제외
- `src/orders/refund.js`: 부분 환불 회수를 환불 상품 금액의 적립률% 버림으로. 전체 취소는 저장값 그대로
- `src/money.js`: `floorPercentOf` 추가
- `docs/knowledge/points/earn-basis.md`: 적립 기준 지식 추가
- 비목표: 저장된 `points.earned`, `src/format/`, 선물하기 적립은 그대로

## 테스트
- `npm test` 28개 통과 (적립 5개, 회수 3개 추가). 기준 `src`로 되돌리면 5개 실패
- `node src/cli.js examples/O-1042.json | grep 적립` → 237P
