# fix: 선물하기 적립 포인트도 일반 주문과 같은 규칙으로 계산한다

## 요약
선물하기 주문의 적립 예정 포인트가 일반 주문과 달라 G-0213이 218P가 아닌 249P로 나왔다. 같은 규칙을 쓰도록 맞췄다.

## 원인
`giftPoints`가 `earnPoints`를 쓰지 않고 결제 금액(배송비 포함)에 반올림을 따로 적용했다. 배송비·쿠폰·사용 포인트가 없으면 결과가 같아 기존 테스트가 놓쳤다.

## 변경
- `src/gift/gift-points.js`: `earnPoints(order)`에 위임
- `test/gift.test.js`: G-0213의 218P, 선물하기와 일반 주문의 적립 동일 테스트 추가
- `docs/knowledge/earn-rule-duplicated-copies.md`: 선물하기 수정 내용 반영
- 비목표: 부분 환불 회수(`src/orders/refund.js`), 이미 적립된 포인트, `src/format/`

## 테스트
- `npm test`: 25개 통과
- `node src/cli.js examples/G-0213.json`: 적립 예정 218P
- 수정 전 코드로 되돌리면 새 테스트 2개가 실패함을 확인
