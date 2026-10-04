---
schema_version: 1
version: 1
type: bugfix
---
## 목표
선물하기 주문의 적립 예정 포인트가 일반 주문과 같은 규칙으로 계산되게 한다. 지금 G-0213은 249P로 나오는데 218P여야 한다.

## 비목표
- 선물 메시지 카드, 받는 사람 정보를 바꾸지 않는다.
- 영수증 글자(`src/format/`)의 출력을 바꾸지 않는다.
- 이미 적립된 포인트(저장된 `points.earned`)를 다시 계산하지 않는다.
- 공용 `percentOf`(반올림)는 바꾸지 않는다.
- 부분 환불(`src/orders/refund.js`)의 `pointsRecovered`는 이번 범위가 아니다.

## 원하는 결과
선물하기 주문의 적립 예정 포인트 = floor((결제 금액 − 배송비) × 1%). G-0213(`examples/G-0213.json`)은 218P가 된다.

## 완료조건
- [ ] 재현 절차(G-0213의 적립 예정 포인트가 249P로 나옴)가 더 이상 실패하지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] G-0213의 선물하기 적립 예정 포인트가 218P이다
- [ ] 선물하기 적립 계산이 배송비를 뺀 결제 금액 기준 원 단위 버림으로 테스트되어 있다(배송비 0원, 버림 경계 포함)
- [ ] 선물 메시지 카드, 받는 사람 정보, `src/format/` 출력이 바뀌지 않는다

## 제약
- (팀 지식 `docs/knowledge/points/earn-points-rule.md`) 적립 포인트 = floor((`amounts.total` − `amounts.shipping`) × 1%). 공용 `percentOf`는 바꾸지 않는다.
- (팀 지식 `docs/knowledge/points/stored-earned-points.md`) 주문에 저장된 `points.earned`는 다시 계산하지 않는다.
- (팀 지식 `docs/knowledge/format/receipt-text.md`) `src/format/`의 출력은 바꾸지 않는다.

## 추가 의견
- 요청이 `src/gift/gift-points.js`를 보라고 했다.
