# fix: 적립 포인트를 배송비 제외·쿠폰/사용 포인트 차감 후 1P 미만 버림으로 계산

## 요약
적립 예정 포인트가 배송비를 포함한 결제 금액에 반올림해 계산되어 O-1042가 268P로 나왔다. 규정대로 237P가 나오도록 일반 주문, 선물하기, 부분 환불 회수를 같은 기준으로 맞췄다.

## 원인
`earnPoints`, `giftPoints`, `createRefund`가 `amounts.total`(배송비 포함) 또는 환불 금액에 반올림 `percentOf`를 썼다.

## 변경
- `src/money.js`: 버림 `floorPercentOf` 추가(`percentOf`는 그대로)
- `src/points/earn.js`: `earnBase`(상품 − 쿠폰 − 사용 포인트, 배송비 제외) 추가, 버림 적용
- `src/gift/gift-points.js`: `earnPoints`에 위임
- `src/orders/refund.js`: 부분 환불 회수를 버림으로 바꾸고 저장된 적립값 이하로 제한. 전체 취소는 변경 없음
- 저장된 `points.earned`와 `src/format/`은 건드리지 않음
- `docs/knowledge/points/earn-rule.md`: 적립 규정 기록

## 테스트
- `npm test`: 28 pass, 0 fail
- 재현 명령으로 O-1042 적립 포인트 237 확인(수정 전 268)
- `test/earn.test.js` 추가: O-1042, 배송비 없는 주문, 선물하기, 부분 환불, 경계값
