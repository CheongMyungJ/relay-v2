---
schema_version: 1
version: 1
type: bugfix
---
## 목표
부분 환불 때 회수하는 포인트(`pointsRecovered`)를 정산팀 기준과 같게 맞춘다. 예: 주문 O-1077의 부분 환불 R-0311은 131P가 아니라 132P를 회수해야 한다.

## 비목표
- 이미 적립된 포인트를 다시 계산하지 않는다. 주문에 저장된 `points.earned`를 그대로 쓴다.
- 이미 처리한 환불을 다시 계산하지 않는다.
- 환불 금액(`refundAmount`)을 바꾸지 않는다.
- 영수증 글자(`src/format/`)를 바꾸지 않는다.
- 전체 취소(`cancelOrder`)와 적립 계산(`earnPoints`)은 이번 범위가 아니다.

## 원하는 결과
부분 환불의 회수 포인트 = 주문에 저장된 원래 적립 포인트 − 남은 상품으로 다시 계산한 적립 포인트.
- 다시 계산한 적립 = (남은 상품 금액 − 쿠폰 할인 − 사용 포인트)의 `POINT_RATE_PERCENT`%를 1P 미만 버림. 배송비는 제외하고, 쿠폰과 사용 포인트는 남은 주문에 그대로 둔다.
- 환불분 금액만 따로 1% 하지 않는다.
- 예: O-1077은 남은 상품 34,180원 − 5,000 − 2,000 = 27,180원 → 271P, 회수 403 − 271 = 132P.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (examples/O-1077.json + examples/R-0311.json으로 `createRefund`를 호출하면 `pointsRecovered`가 132다)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 같은 입력에서 `refundAmount`가 변경 전과 같다 (O-1077/R-0311은 13,130)
- [ ] `src/format/`의 파일이 바뀌지 않는다
- [ ] 회수 포인트 계산이 `points.earned`를 쓰고 주문 금액으로 적립을 다시 계산하지 않는다
- [ ] 위 계산 규칙(남은 상품 기준 버림 차이)을 확인하는 테스트가 추가되어 통과한다

## 제약
- (팀 지식 docs/knowledge/points/earn-rule.md) 부분 환불의 회수도 소수점 버림 기준을 쓴다.
- (팀 지식 docs/knowledge/points/earn-rule.md) 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 `points.earned`를 쓴다.
- (팀 지식 docs/knowledge/points/earn-rule.md) 영수증 글자(`src/format/`)는 바꾸지 않는다.

## 추가 의견
- 요청이 가리킨 위치: `src/orders/refund.js`
