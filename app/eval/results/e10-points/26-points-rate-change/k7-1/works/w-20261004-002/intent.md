---
schema_version: 1
version: 1
type: bugfix
---
## 목표
부분 환불(`createRefund`, `src/orders/refund.js`)에서 회수하는 포인트가 정산팀 계산과 맞도록 한다. 현재 O-1077의 부분 환불 R-0311은 131P를 회수하는데 정산팀 계산은 132P이다(1~2P 차이).

## 비목표
- 이미 저장된 주문의 적립값(`points.earned`)과 이미 처리한 환불을 다시 계산하거나 수정하지 않는다.
- 환불 금액(`refundAmount`)과 영수증 글자(`src/format/`)는 바꾸지 않는다.
- 전체 취소(`cancelOrder`)의 동작은 바꾸지 않는다.

## 원하는 결과
부분 환불의 포인트 회수가 정산팀 기준과 일치한다. R-0311(O-1077) 회수는 132P이다. 회수가 해당 주문의 적립을 넘지 않는다.

## 완료조건
- [ ] 재현 절차(examples/O-1077.json 주문에 examples/R-0311.json 환불)가 더 이상 실패하지 않는다. 회수 포인트가 132P이다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] R-0311의 `refundAmount`는 수정 전과 같다
- [ ] 영수증 출력(`src/format/`)과 저장된 주문의 `points.earned`는 수정 전과 같다
- [ ] 부분 환불 회수 포인트가 해당 주문의 적립 포인트를 넘지 않는 경우를 확인하는 테스트가 있다

## 제약
- (팀 지식 `docs/knowledge/refund-recovery-follows-earn-rule.md`) 부분 환불의 회수는 적립과 같은 기준으로 계산하고 적립을 넘지 않는다. 상품 금액에 바로 적립률을 곱하지 않고, 환불 전후 적립 기준 금액(남은 상품 − 쿠폰 − 사용 포인트)의 적립 차이로 회수한다. 예: O-1077(적립 403P)에서 13,130원 환불 → 403 − 271 = 132P.
- (팀 지식 `docs/knowledge/points-earn-excludes-shipping-floor.md`) 적립 계산은 `earnOn`/`earnPoints` 한 곳에 두고 환불 회수가 이를 쓴다. 복제하지 않는다. 배송비 제외, 소수점 버림.
- (팀 지식 `docs/knowledge/points-earn-saved-orders-not-recomputed.md`) 저장된 주문의 `points.earned`는 소급 수정하지 않는다. O-1077은 저장된 주문이라 `--order` 인자로 쓴다.

## 추가 의견
- 요청에 원인 추정은 없음.
