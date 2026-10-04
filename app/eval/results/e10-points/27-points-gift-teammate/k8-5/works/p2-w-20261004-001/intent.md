---
schema_version: 1
version: 1
type: bugfix
---
## 목표
선물하기 주문 G-0213(`examples/G-0213.json`)의 적립 예정 포인트가 249P로 나오는데, 고객센터 기준 218P여야 한다는 문의를 바로잡는다. 같은 상품을 일반 주문으로 샀을 때와 왜 다른지도 확인해 알린다.

## 비목표
- `src/gift/gift-points.js`(`giftPoints`)는 수정하지 않는다. 다른 팀과 협의 전이다.
- 선물 메시지 카드와 받는 사람 정보는 바꾸지 않는다.
- 영수증 글자(`src/format/`)는 바꾸지 않는다.
- 이미 적립된 포인트는 다시 계산하지 않는다.
- 부분 환불의 `pointsRecovered` 식(`src/orders/refund.js`)은 이번에 고치지 않는다.

## 원하는 결과
- 선물하기 주문 G-0213의 적립 예정 포인트가 218P로 나온다.
- 일반 주문과 선물하기 주문의 적립 포인트가 달랐던 이유가 설명돼 있다.
- 수정은 `giftPoints`를 건드리지 않고 선물 주문을 만드는 쪽(호출부)에서 한다. 사람이 정한 범위다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (G-0213의 적립 예정 포인트가 249P가 아니라 218P다)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `src/gift/gift-points.js`가 변경되지 않았다
- [ ] 선물 메시지, 받는 사람 정보, 영수증 글자(`src/format/`) 출력이 변경 전과 같다
- [ ] 이미 저장된 주문의 `points.earned`를 다시 계산하는 코드가 추가되지 않았다
- [ ] 일반 주문과 선물 주문의 적립 포인트가 달랐던 이유가 fix 결과에 적혀 있다

## 제약
- (팀 지식 `docs/knowledge/points/gift-points-hands-off.md`) `src/gift/gift-points.js`는 다른 팀과 함께 보고 있어 포인트 적립 수정 일에서도 손대지 않는다.
- (팀 지식 `docs/knowledge/points/stored-points-not-recalculated.md`) 주문의 `points.earned`는 주문 생성 때 한 번만 계산해 저장한다. 이미 적립된 주문은 다시 계산하지 않는다.
- (팀 지식 `docs/knowledge/points/earn-points-formula.md`) `percentOf`(`src/money.js`)는 선물하기와 공유하므로 바꾸지 않는다.

## 추가 의견
- 요청에 "관련 코드는 `src/gift/gift-points.js`"라고 돼 있으나, 위 팀 규칙에 따라 수정 대상에서 뺐다. 호출부에서 해결하기로 사람이 골랐다.
