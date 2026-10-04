# 적립률을 2%로 올리고 적립을 배송비 제외 버림으로 계산

## 요약
기본 적립률을 1%에서 2%로 올린다. O-1107은 24,330원의 2%인 486P가 적립된다. 부분 환불 회수는 기존 1% 계산을 그대로 둔다.

## 원인
- `POINT_RATE_PERCENT`가 1이었고, `earnPoints`/`giftPoints`가 배송비를 포함한 `amounts.total`을 반올림했다.
- `refund.js`가 같은 상수를 직접 써서 상수만 2로 바꾸면 환불 회수도 함께 바뀌었다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT = 2`, 환불 회수용 `REFUND_RECOVER_RATE_PERCENT = 1` 분리 (새 비율 적용은 정산팀과 따로 정함)
- `src/money.js`: 원 단위 미만 버림 `floorPercentOf` 추가
- `src/points/earn.js`, `src/gift/gift-points.js`: `total - shipping`의 율%를 버림
- `src/orders/refund.js`: 회수 비율을 `REFUND_RECOVER_RATE_PERCENT`로 (결과 동일)
- 이미 적립된 `points.earned`는 재계산하지 않고, `src/format/`은 바꾸지 않았다
- 지식: `docs/knowledge/points/earn-rule.md` 갱신, `refund-recover-rate.md` 추가

## 테스트
- `npm test`: 23개 통과
- 새 `test/earn.test.js`: O-1107 → 486P, 버림, 환불 회수 1% 유지
- 기대값을 2%로 바꾼 기존 테스트: `test/order.test.js`(500 → 1000), `test/gift.test.js`(300 → 600)
