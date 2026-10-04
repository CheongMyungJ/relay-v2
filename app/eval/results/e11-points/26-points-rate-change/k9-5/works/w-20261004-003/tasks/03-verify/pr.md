# 일반 주문·선물하기 적립률을 2%로 올리고 적립 기준액을 배송비 제외 금액으로 맞춘다

## 요약
`POINT_RATE_PERCENT`를 1%에서 2%로 올리고, 일반 주문과 선물하기의 적립 기준액을 배송비 제외(상품 − 쿠폰 − 사용 포인트), 원 단위 버림으로 맞췄다. O-1107은 486P다. 부분 환불 회수는 이번 범위가 아니라 기존 동작(1%, 반올림)을 유지한다.

## 원인
적립이 배송비를 포함한 결제금액을 반올림해 계산했고 선물하기가 같은 식을 따로 썼다. 비율만 올리면 O-1107은 547P가 되어 고객센터 예시 486P와 달랐다.

## 변경
- `src/config.js`: 적립률 2%. 환불 회수 비율은 `REFUND_RECOVER_RATE_PERCENT`(1%)로 분리해 기존 동작을 유지.
- `src/money.js`: `floorPercentOf`(버림) 추가.
- `src/points/earn.js`: `earnBase`, `earnOnBase`. 일반 주문과 선물하기가 사용.
- `src/orders/refund.js`: 회수 계산은 그대로, 비율만 `REFUND_RECOVER_RATE_PERCENT` 참조.
- 전체 취소와 영수증(`src/format/`)은 변경 없음.
- `docs/knowledge/points/earn-rule.md`: 적립률 2%와 환불 회수 미적용 상태 기록.

## 테스트
- `npm test`: 21개 통과.
- 새 테스트: O-1107 = 486P. order·gift 기대값 2곳을 2%에 맞춰 갱신(약화 아님). 환불 테스트는 변경 없음.
- 후속: 환불 회수에 새 비율을 적용할지는 정산팀과 따로 정한다.
