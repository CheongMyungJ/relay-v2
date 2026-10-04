# fix: 선물하기 주문의 적립 예정 포인트를 일반 주문과 같은 기준으로 계산

## 요약
선물하기 주문 G-0213의 적립 예정 포인트가 249P로 나오던 것을 고객센터 기준 218P로 고쳤다.

## 원인
`giftPoints`가 `earnPoints`를 쓰지 않고 `total`에 `percentOf`(반올림)를 직접 적용했다. 그래서 배송비가 기준에 들어가고 원 단위 미만이 반올림되었다.

## 변경
- `src/gift/gift-points.js`: `giftPoints`가 `earnPoints`를 부른다.
- `docs/knowledge/points/earn-basis.md`: gift-points를 "규칙을 따르지 않는 곳"에서 빼고 이력을 더했다.

## 테스트
- `npm test` 27건 통과.
- `test/gift.test.js`에 2건 추가: G-0213 = 218P, 같은 입력의 일반 주문과 같은 값.
- 환불 회수 포인트(`src/orders/refund.js`)는 범위 밖이라 그대로다.
