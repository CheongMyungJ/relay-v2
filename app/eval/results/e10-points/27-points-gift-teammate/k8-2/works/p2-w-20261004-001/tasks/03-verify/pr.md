# fix: 선물하기 적립 포인트도 일반 주문과 같은 규칙(earnPoints)으로 계산

## 요약
선물하기 주문 G-0213의 적립 예정 포인트가 249P로 나오던 것을 일반 주문 규칙으로 계산해 218P로 고쳤다.

## 원인
`giftPoints`가 `earnPoints`와 별도로 `percentOf(total, 1)`을 써서 배송비를 빼지 않고 반올림했다. 5ff61ae는 `earn.js`만 고쳐 선물하기가 어긋났다.

## 변경
- `src/gift/gift-points.js`: 자체 계산을 없애고 `earnPoints(order)`를 호출한다. 일반 주문 계산과 비목표(적립률, 이미 적립된 포인트)는 바꾸지 않았다.
- `test/gift.test.js`: G-0213 조건의 선물 주문과 일반 주문의 적립이 218P로 같은지 보는 테스트를 추가했다.
- `docs/knowledge/points/`: 적립 계산 단일 규칙과 재계산 금지 규칙을 남겼다.

## 테스트
- `npm test`: 23개 모두 통과.
- `node src/cli.js examples/G-0213.json`: 적립 예정 218P.
- 수정 전 코드로 되돌리면 새 테스트가 expected 218, actual 249로 실패함을 확인했다.
- 참고: 환불 회수 포인트(`refund.js`)는 반올림이라 별도 확인이 필요하다.
