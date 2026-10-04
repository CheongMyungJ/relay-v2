---
schema_version: 1
version: 1
type: bugfix
---
## 목표
선물하기 주문의 적립 예정 포인트를 팀의 적립 기준(상품 금액 − 쿠폰 − 사용 포인트의 1%, 원 단위 내림)에 맞게 계산한다. G-0213이 지금 249P로 나오지만 고객센터 기준은 218P다.

## 비목표
- 선물 메시지 카드, 받는 사람 정보, 영수증 글자(`src/format/`)는 바꾸지 않는다.
- 이미 적립된 포인트는 다시 계산하지 않는다.
- 공용 `percentOf`(`src/money.js`)는 고치지 않는다.
- 부분 환불 회수(`src/orders/refund.js`)는 이번 범위가 아니다.

## 원하는 결과
- `examples/G-0213.json`의 적립 예정 포인트가 218P로 나온다 (상품 24,860 − 쿠폰 2,000 − 포인트 1,000 = 21,860, 1% = 218.6 → 218).
- 배송비는 적립 기준에서 빠진다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (G-0213의 적립 예정 포인트가 218P)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 선물하기 적립 계산이 `goods − coupon − pointsUsed`의 1%를 내림한 값이다
- [ ] 선물 메시지 카드, 받는 사람 정보, `src/format/`의 출력은 변경 전과 같다

## 제약
- (팀 지식 `docs/knowledge/points/earn-points-basis.md`) 적립 기준 금액은 `goods − coupon − pointsUsed`이고 배송비는 뺀다.
- (팀 지식 `docs/knowledge/points/earn-points-basis.md`) 적립률을 곱한 값은 원 단위로 내림하며 반올림하지 않는다.
- (팀 지식 `docs/knowledge/points/earn-points-basis.md`) 공용 `percentOf`는 반올림이며 환불 회수도 쓰므로 고치지 않는다.

## 추가 의견
- 요청이 `src/gift/gift-points.js`를 확인하라고 했다.
