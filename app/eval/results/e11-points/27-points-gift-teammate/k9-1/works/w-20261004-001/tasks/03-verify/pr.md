# fix: 적립 예정 포인트를 배송비 제외 금액 기준 버림으로 계산

## 요약
적립 예정 포인트가 배송비가 포함된 결제 금액을 반올림해 실제보다 많게 나오던 문제를 고쳤다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 `amounts.total`(배송비 포함)의 1%를 반올림했다. 고객센터 기준은 (상품 − 쿠폰 − 사용 포인트)의 1%를 버림한 값이다. 기준은 237P에서 역산했다.

## 변경
- `src/points/earn.js`: 기준 금액과 버림 처리 변경. 이미 적립된 값이 있으면 그대로 사용.
- `test/earn.test.js`: 회귀 테스트 추가.
- `src/format/`, `src/gift/gift-points.js`, `src/money.js`는 변경하지 않았다.
- `docs/knowledge/points/earn-basis.md`: 적립 기준과 아직 따르지 않는 곳(선물하기, 환불 회수) 기록.

## 테스트
- `node src/cli.js examples/O-1042.json` → 적립 예정 237P
- `npm test` → 24개 통과
