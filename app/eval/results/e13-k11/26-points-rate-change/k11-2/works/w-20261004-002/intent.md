---
schema_version: 1
version: 1
type: bugfix
---
## 목표
부분 환불 때 회수하는 포인트(`pointsRecovered`)가 정산팀 계산과 1~2P씩 어긋나는 문제를 고친다.

## 비목표
- 이미 적립된 포인트(`order.points.earned`)와 이미 처리한 환불 내역을 다시 계산하지 않는다.
- 환불 금액(`refundAmount`)을 바꾸지 않는다.
- 영수증 글자(`src/format/`)를 바꾸지 않는다.
- 전체 취소(`cancelOrder`)와 선물하기 적립(`src/gift/`)은 이번 요청 범위가 아니다.

## 원하는 결과
- 부분 환불의 회수 포인트가 정산팀 계산과 맞는다. 예: 주문 O-1077의 부분 환불 R-0311(`examples/O-1077.json`, `examples/R-0311.json`)은 지금 131P인데 132P가 되어야 한다.
- 회수 포인트는 팀 규칙대로 "환불 전 남은 주문의 적립 - 환불 후 남은 주문의 적립"이다. 적립은 `earnPoints`의 계산을 따른다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (R-0311 환불의 `pointsRecovered`가 132)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 부분 환불 회수 포인트가 "환불 전 남은 주문의 적립 - 환불 후 남은 주문의 적립"과 같다는 테스트가 있다
- [ ] 같은 입력에서 `refundAmount`와 `src/format/`의 영수증 출력이 수정 전과 같다
- [ ] 이미 저장된 주문의 `points.earned`와 `alreadyRefunded` 처리 결과가 수정 전과 같다

## 제약
- (팀 지식 `docs/knowledge/points/earn-rule.md`) 적립 기준 금액 = 상품 금액 - 쿠폰 할인 - 사용 포인트(배송비 제외). 적립 = 기준 금액 × `POINT_RATE_PERCENT`%를 1P 미만 내림. 부분 환불 회수 = 환불 전 남은 주문의 적립 - 환불 후 남은 주문의 적립.

## 추가 의견
- 없음
