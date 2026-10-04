# 적립률을 2%로 올리고 적립 기준 금액을 상품−쿠폰−사용 포인트로 계산

## 요약
일반 주문과 선물하기 적립을 2%로 올렸다. 예시 주문 O-1107은 486P가 적립된다.

## 원인
적립이 배송비가 포함된 결제 금액에 1%를 곱해 반올림했다. 기대값 486P는 팀 규칙의 기준 금액(상품 − 쿠폰 − 사용 포인트, 배송비 제외)과 1P 미만 버림으로만 나온다. 비율만 2%로 바꾸면 547P가 된다.

## 변경
- `src/config.js`: 적립용 `EARN_RATE_PERCENT = 2` 추가. 환불 회수가 쓰는 `POINT_RATE_PERCENT`(1%)는 그대로 둔다.
- `src/points/earn.js`: `earnBase` 추가, 적립은 기준 금액 × 2% 버림.
- `src/gift/gift-points.js`: `earnPoints`와 같은 기준 사용.
- `docs/knowledge/points/earn-rule.md`: 적립률 2%와 환불 회수 비율 미정 기록.
- 이미 저장된 `points.earned`와 `src/format/`은 바꾸지 않았다.
- 부분 환불 회수의 새 비율은 정산팀과 따로 정한다(이번 범위 밖).

## 테스트
- `npm test`: 23개 통과.
- 추가: `test/earn.test.js`(O-1107 486P, 선물하기, 저장값 유지).
- 기대값 변경: `test/order.test.js` 500 → 1000, `test/gift.test.js` 300 → 600 (2% 반영). `test/receipt.test.js`는 수정 없음.
