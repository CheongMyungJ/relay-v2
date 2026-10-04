# fix: 선물하기 적립 예정 포인트를 일반 주문과 같은 기준으로 계산

## 요약
선물하기 주문의 적립 예정 포인트가 배송비를 포함한 금액을 반올림해 일반 주문보다 많게 나왔다. G-0213이 249P에서 218P가 된다.

## 원인
`giftPoints`가 배송비를 포함한 결제 금액(`amounts.total`)에 반올림 `percentOf`를 적용했다. 일반 주문의 `earnPoints`는 배송비를 빼고 버림을 쓴다. 배송비가 0인 기존 테스트는 두 방식이 같아 잡지 못했다.

## 변경
- `src/gift/gift-points.js`: 자체 계산을 없애고 `earnPoints`에 위임
- `test/gift-points.test.js`: G-0213 218P, 일반 주문과 동일, 이미 적립된 값 사용 테스트 추가
- `docs/knowledge/points/earn-basis.md`: 선물하기가 규칙을 따르게 되어 갱신
- 환불 회수 포인트(`refund.js`)와 `percentOf`는 바꾸지 않았다

## 테스트
- `npm test`: 27개 통과
- `node src/cli.js examples/G-0213.json`: 적립 예정 218P (수정 전 249P)
- 새 테스트는 수정 전 코드에서 3개 실패, 수정 후 통과
