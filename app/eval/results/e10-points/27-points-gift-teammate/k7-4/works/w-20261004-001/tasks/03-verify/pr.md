# fix: 적립 포인트에서 배송비를 제외하고 1P 미만은 버린다

## 요약
새 주문의 적립 예정 포인트가 고객센터 계산과 같게 나오도록 바로잡았다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비가 포함된 결제 금액(`amounts.total`)에 반올림(`percentOf`)을 적용했다. 규칙은 (상품 금액 - 쿠폰 - 사용 포인트)의 1%, 배송비 제외, 버림이다. 무료배송 주문은 total과 같아 기존 테스트에서 드러나지 않았다.

## 변경
- `src/points/earn.js`: (goods - coupon - pointsUsed) × 1%를 `Math.floor`로 계산
- `test/earn.test.js`: 재현 테스트 3개 추가
- `docs/knowledge/`: 적립 규칙과 중복 계산 위치 기록
- 비목표: 저장된 `points.earned`, `src/format/`, 선물하기 적립은 바꾸지 않았다. 부분 환불 회수(`src/orders/refund.js:34`)도 옛 방식 그대로다.

## 테스트
- `node src/cli.js examples/O-1042.json` → 적립 예정 237P
- `npm test` → 23개 통과
