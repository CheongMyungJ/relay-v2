## 재현
- 재현 절차: 작업 폴더에서 `node src/cli.js examples/O-1107.json`
- 결과: 재현됨
- 기대: 적립 예정 486P (기준 금액 24,330 × 2% 버림)
- 실제: 273P (결제 금액 27,330 × 1% 반올림). 상수만 2로 올려도 547P가 나온다(배송비 포함 기준)

## 원인
- 원인: 적립률 `POINT_RATE_PERCENT`가 1이고, 이 브랜치의 `earnPoints`는 배송비를 포함한 결제 금액을 반올림한다. 같은 상수를 환불 회수(`refund.js`)도 써서 상수만 바꾸면 환불 회수도 따라 바뀐다.
- 근거: `src/config.js:9`, `src/points/earn.js:6`, `src/orders/refund.js:34`. 수정 전 CLI 출력 273P. 수정 전 코드로 되돌려 새 테스트가 실패함을 확인했다.
- 사람 추정 판정: 없음
- 기각한 가설: 상수만 2로 변경 — O-1107이 547P가 되고 환불 회수도 2%로 바뀌어 완료조건에 어긋남

## 변경 요약
- src/config.js — `POINT_RATE_PERCENT` 2로 변경, 환불 회수용 `REFUND_RECOVER_RATE_PERCENT = 1` 추가
- src/money.js — 버림 도우미 `floorPercentOf` 추가
- src/points/earn.js — 기준을 `상품 − 쿠폰 − 사용 포인트`(배송비 제외), 버림으로 변경 (사람이 이 브랜치에서 함께 고치도록 선택)
- src/orders/refund.js — 회수 비율을 `REFUND_RECOVER_RATE_PERCENT`(1%)로 분리해 기존 동작 유지
- 선물하기(`gift-points.js`)는 그대로 두었고 상수를 따라 2%가 된다 (반올림·결제 금액 기준 유지)
- (기존 테스트 변경) test/order.test.js — 적립 기대값 500 → 1000 (2%)
- (기존 테스트 변경) test/gift.test.js — 적립 기대값 300 → 600 (2%)

## 재현 테스트
- 위치: test/order.test.js(O-1107 → 486P), test/refund.test.js(환불 회수 1% 유지 보호 테스트)
- 수정 전: 실패 (`npm test` — O-1107 테스트 포함 3건 실패; 환불 보호 테스트는 수정 전에도 통과, 회귀 방지용)
- 수정 후: 통과 (`npm test` 22건 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 22 통과, 0 실패
- 실패 항목: 없음. `src/format/` 변경 없음. 수정 후 CLI: O-1107 486P, R-0311 회수 131P(변경 전과 동일)
