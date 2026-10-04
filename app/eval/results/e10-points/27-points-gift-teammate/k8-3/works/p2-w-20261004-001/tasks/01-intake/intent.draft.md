## 목표
선물하기 주문 G-0213(`examples/G-0213.json`)의 적립 예정 포인트(현재 249P)가 같은 상품을 일반 주문으로 샀을 때와 같은 기준(배송비를 뺀 결제 금액의 1%, 1P 미만 버림)으로 나오게 고친다.

## 비목표
- `src/gift/gift-points.js`와 공용 `percentOf`(`src/money.js`)는 수정하지 않는다.
- 선물 메시지 카드, 받는 사람 정보, 영수증 글자(`src/format/`)는 바꾸지 않는다.
- 이미 적립된 포인트(주문에 저장된 `points.earned`)는 다시 계산하지 않는다.
- 환불 회수 포인트(`src/orders/refund.js`)는 이번 범위가 아니다.

## 원하는 결과
G-0213의 적립 예정 포인트가 일반 주문과 같은 규칙(`earnPoints` 기준)으로 계산된다. 값만 바뀌고 영수증 글자 모양은 그대로다.

## 완료조건
- [ ] 재현 절차(G-0213의 적립 예정 포인트 확인)가 더 이상 실패하지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] G-0213의 적립 예정 포인트가 `earnPoints` 규칙(배송비 제외, 1P 미만 버림)으로 계산한 값과 같다
- [ ] `src/gift/gift-points.js`, `src/money.js`, `src/format/`에 변경이 없다
- [ ] 이미 저장된 `points.earned` 값을 다시 계산하는 코드가 추가되지 않는다

## 제약
- (팀 지식 `docs/knowledge/gift/gift-points-hands-off.md`) `src/gift/gift-points.js`는 수정하지 않는다. 공용 `percentOf`도 바꾸지 않고, 일반 주문 적립은 `src/points/earn.js`에서만 계산한다. (사람이 이번에도 유지하기로 확인)
- (팀 지식 `docs/knowledge/format/receipt-text-frozen.md`) `src/format/`의 영수증 글자는 바뀌면 안 된다.
- (팀 지식 `docs/knowledge/points/stored-points-not-recalculated.md`) 적립 계산은 주문 생성 시 한 번만 하고, 저장된 값은 다시 계산하지 않는다.

## 추가 의견
- (사람 추정, 확인 안 됨) 요청은 포인트 계산이 `src/gift/gift-points.js`에 있다고 보고 있다. 단, 같은 파일을 고치라는 요청과 수정 금지 규칙이 충돌해 사람이 수정 금지 유지로 정했다.
