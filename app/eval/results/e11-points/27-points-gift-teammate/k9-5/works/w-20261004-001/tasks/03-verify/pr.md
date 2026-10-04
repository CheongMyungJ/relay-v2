# fix: 적립 예정 포인트를 배송비 제외 금액 기준, 원 단위 미만 버림으로 계산

## 요약
적립 예정 포인트가 배송비를 포함한 결제 금액에 반올림해서 많게 나오던 문제를 고쳤다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비(3,000원)가 든 `amounts.total`에 1%를 곱해 반올림했다. 고객센터 기준은 배송비를 뺀 금액(상품 - 쿠폰 - 사용 포인트)의 1%를 버림한 값이다.

## 변경
- `src/points/earn.js`: 기준을 `goods - coupon - pointsUsed`로, 계산을 `Math.floor`로 변경. `percentOf`는 선물하기·환불이 같이 쓰므로 그대로 둠
- `test/earn.test.js`: 재현 테스트 추가
- `docs/knowledge/points/earn-basis.md`: 적립 기준 기록
- 선물하기 적립과 영수증 글자, 이미 저장된 포인트는 바꾸지 않음

## 테스트
- `npm test`: 25개 통과
- O-1042 재현 절차: 237P 확인
