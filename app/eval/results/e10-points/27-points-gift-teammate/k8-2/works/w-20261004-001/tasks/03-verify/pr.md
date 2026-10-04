# fix: 적립 포인트에서 배송비를 빼고 원 단위 내림으로 계산

## 요약
주문의 적립 예정 포인트가 고객센터 적립 안내보다 많게 나오던 버그를 고쳤다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비가 포함된 결제 금액(`amounts.total`)에 반올림(`percentOf`)을 적용했다. 적립 기준은 배송비를 뺀 금액의 1%를 원 단위로 내린 값이다.

## 변경
- `src/points/earn.js`: `total - shipping`의 1%를 `Math.floor`로 내린다. `money.js`는 바꾸지 않았다.
- `test/earn.test.js`: 재현 테스트 추가(O-1042 = 237P, 배송비 0이며 소수 .7인 사례).
- 저장된 `points.earned`는 다시 계산하지 않는다. `src/format/`, `src/gift/gift-points.js`는 변경 없음.
- 알려진 한계: 부분 환불 회수 포인트(`src/orders/refund.js`)와 선물하기 적립은 아직 반올림 방식이다.

## 테스트
- `npm test`: 22개 통과
- `node src/cli.js examples/O-1042.json`: 적립 예정 237P
