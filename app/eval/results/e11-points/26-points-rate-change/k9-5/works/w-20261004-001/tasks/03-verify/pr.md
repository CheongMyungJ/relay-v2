# fix: 포인트 적립을 배송비 제외 기준액의 버림으로 계산한다

## 요약
O-1042의 적립 예정 포인트가 안내(237P)보다 많은 268P로 나오던 버그를 고친다. 선물하기 적립과 부분 환불 회수도 같은 규칙을 따른다.

## 원인
적립이 배송비가 포함된 결제금액(`amounts.total`)에 반올림(`percentOf`)을 적용했다. 안내 규칙은 배송비 제외, 원 단위 버림이다.

## 변경
- `src/money.js`: `floorPercentOf`(버림) 추가
- `src/points/earn.js`: `earnBase`(상품−쿠폰−사용 포인트), `earnOnBase` 추가, `earnPoints`가 사용
- `src/gift/gift-points.js`: `earnPoints`를 그대로 사용
- `src/orders/refund.js`: 부분 환불 회수 = 환불 전 기준액 적립 − 환불 후 기준액 적립
- `docs/knowledge/points/earn-rule.md`: 적립 규칙 기록
- 전체 취소와 영수증은 저장된 `points.earned`를 써서 그대로다.

## 테스트
- `npm test`: 25 pass, 0 fail (O-1042 → 237, G-0213 → 218, 환불 회수 3건 추가)
- 주의: 예전 반올림으로 저장된 주문은 부분 환불 회수가 저장값과 최대 1P 어긋날 수 있다.
