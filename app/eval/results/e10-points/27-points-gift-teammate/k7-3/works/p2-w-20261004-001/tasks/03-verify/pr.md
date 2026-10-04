# fix: 선물하기 적립을 일반 주문과 같은 기준으로 계산

## 요약
선물하기 주문 G-0213의 적립 예정이 고객센터 계산(218P)과 달리 249P로 나오던 문제를 고쳤다.

## 원인
`giftPoints`가 배송비가 포함된 결제 금액의 1%를 반올림했다. 일반 주문은 (상품 금액 - 쿠폰 - 사용 포인트)의 1%를 원 미만 버림한다.

## 변경
- `src/gift/gift-points.js`: `earnPoints(order)`를 호출해 기준을 한 곳에서 유지한다 (사람이 수정을 허용함, 다른 팀 협의 여부는 미확인)
- `test/gift.test.js`: G-0213 = 218P 테스트 추가
- `docs/knowledge/`: 적립 규칙과 선물하기 이력 갱신
- 이미 적립된 `order.points.earned`, 영수증 글자, 부분 환불(refund.js)은 바꾸지 않았다.

## 테스트
- `npm test`: 25개 통과
- `node src/cli.js examples/G-0213.json`: 적립 예정 249P → 218P (다른 줄 동일)
