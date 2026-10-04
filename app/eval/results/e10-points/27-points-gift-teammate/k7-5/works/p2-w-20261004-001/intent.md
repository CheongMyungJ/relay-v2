---
schema_version: 1
version: 1
type: bugfix
---
## 목표
선물하기 주문의 적립 예정 포인트를 일반 주문과 같은 기준으로 계산한다. 고객센터 기준으로 G-0213은 218P여야 하는데 지금은 249P로 나온다.

## 비목표
- `percentOf`(src/money.js)와 일반 주문 적립(src/points/earn.js)은 바꾸지 않는다.
- 환불 회수(src/orders/refund.js)의 반올림은 고치지 않는다.
- 선물 메시지 카드, 받는 사람 정보, 영수증 글자(src/format/)는 바꾸지 않는다.
- 이미 저장된 주문의 `points.earned`는 재계산하거나 바꾸지 않는다.

## 원하는 결과
선물하기 적립이 일반 주문 기준(배송비를 뺀 결제 금액 × 적립률, 원 단위 버림)으로 계산된다. 변경은 src/gift/gift-points.js 안에서만 한다. 기준은 일반 주문 쪽 코드(동료가 고객센터와 맞춰 둔 것)다. 새로 만드는 선물 주문부터 적용된다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (examples/G-0213.json으로 선물 주문을 만들면 적립이 218P)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 일반 주문 적립 결과(earnPoints)와 같은 상품·금액의 선물 주문 적립 결과가 같다
- [ ] src/gift/gift-points.js 외의 소스 파일(src/money.js, src/format/ 등)은 바뀌지 않는다
- [ ] 선물 메시지와 받는 사람 정보, 영수증 출력은 수정 전과 같다

## 제약
- (팀 지식 docs/knowledge/gift-points-hands-off.md) 선물하기 적립은 다른 팀과 같이 보는 중이고, `percentOf`는 gift-points.js와 refund.js가 공유하므로 고치지 않는다. 사람이 이번 Work에서 gift-points.js 수정을 허용했다.
- (팀 지식 docs/knowledge/no-recalc-saved-points.md) 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다.
- (팀 지식 docs/knowledge/receipt-text-unchanged.md) 형식 코드(src/format/)는 건드리지 않고 계산 쪽에서 고친다.

## 추가 의견
- (사람 추정, 확인 안 됨) src/gift/gift-points.js 쪽 문제로 보인다.
- 다른 팀과 선물하기 적립 변경을 합의했는지는 사람도 모른다. 사람이 수정을 허용했다.
