# 적립률을 2%로 올리고 적립 기준을 배송비 제외·버림으로 맞춘다

## 요약
이번 배포부터 새 주문의 적립률을 1%에서 2%로 올린다. 적립 기준은 팀 규칙대로 배송비를 뺀 금액의 버림이다. 환불 회수와 저장된 주문, 영수증 글자는 그대로다.

## 원인
`earnPoints`와 `giftPoints`가 배송비를 포함한 결제 금액에 `POINT_RATE_PERCENT`를 곱해 반올림했다. 상수만 2로 바꾸면 O-1107이 547P가 되어 고객센터 값 486P와 어긋나고, `refund.js`가 같은 상수를 써서 환불 회수도 함께 바뀐다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT = 2`. 환불 회수용 `REFUND_RECOVERY_RATE_PERCENT = 1`을 새로 둠
- `src/points/earn.js`: (상품 − 쿠폰 − 사용 포인트)의 적립률%를 원 단위 버림
- `src/gift/gift-points.js`: `earnPoints`에 위임
- `src/orders/refund.js`: 회수에 `REFUND_RECOVERY_RATE_PERCENT` 사용(계산식은 그대로)
- 테스트: 적립 기대값 2건을 2%로 수정, `test/earn-rate.test.js` 추가
- 지식: `docs/knowledge/points/point-rate.md` 추가, 환불 회수 항목에 미적용 위치 기록

## 테스트
- `npm test` 23건 통과
- O-1107 486P, G-0213 437P
- 환불 회수는 변경 전과 같음(O-1107/O-1077/O-1042 비교)
- 저장된 적립 값은 영수증에 그대로 나옴, `src/format/` 변경 없음
