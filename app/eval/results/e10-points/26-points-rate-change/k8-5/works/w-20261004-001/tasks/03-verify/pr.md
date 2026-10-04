# fix: 적립 포인트에서 배송비를 빼고 소수점을 버린다

## 요약
적립 예정 포인트가 고객센터 계산보다 많게 나오던 버그를 고쳤다. O-1042는 268P에서 237P가 된다.

## 원인
적립을 배송비가 포함된 결제 금액(`amounts.total`)에 반올림으로 계산했다. 기준은 배송비를 뺀 금액의 1%를 버림한 값이다.

## 변경
- `src/points/earn.js`: `total - shipping`의 1%를 버림 (`src/money.js`의 `floorPercentOf` 추가)
- `src/gift/gift-points.js`: `earnPoints`로 위임
- `src/orders/refund.js`: 부분 환불 회수를 버림으로 맞춤
- `docs/knowledge/points/earn-rule.md`: 적립 규칙 기록
- `src/format/`과 저장된 `points.earned`는 바꾸지 않았다.

## 테스트
- `npm test` 26개 통과. `test/earn.test.js` 추가(O-1042, O-1107, O-1077, 버림, 선물, 환불 회수)
- `node src/cli.js examples/O-1042.json` → 적립 예정 237P
- 고객센터 기준은 O-1042 한 건이며, 나머지 기대값은 같은 규칙으로 계산했다.
