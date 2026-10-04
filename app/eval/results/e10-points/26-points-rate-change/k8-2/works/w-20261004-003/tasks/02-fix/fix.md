## 재현
- 재현 절차: `node src/cli.js examples/O-1107.json` (수정 전 상태에서 적립률만 2로 바꿔도 동일)
- 결과: 재현됨
- 기대: 적립 예정 486P
- 실제: 273P (현재 1%). 비율만 2%로 바꾸면 547P (결제 금액 27,330원 × 2% 반올림)

## 원인
- 원인: 적립 기준이 결제 금액(배송비 포함, 사용 포인트 차감 후, 반올림)이라 비율만 올려서는 486P가 나오지 않는다. 기대값은 상품 − 쿠폰 − 사용 포인트(배송비 제외) 24,330원의 2%를 버림한 값이다. 또 `createRefund`가 `POINT_RATE_PERCENT`를 직접 써서 상수를 바꾸면 환불 회수도 달라진다.
- 근거: `src/points/earn.js`, `src/gift/gift-points.js`가 `percentOf(order.amounts.total, ...)`(`src/money.js:14` Math.round) 사용. `src/orders/refund.js:34`가 같은 상수 사용. 수정 뒤 `node src/cli.js examples/O-1107.json`이 486P, R-0311 환불은 131P 유지(실험 확인).
- 사람 추정 판정: 요청/추가 의견의 "486P는 24,330원의 2%(486.6) 버림과 같다" — 맞음. O-1107 상품 27,350 − 쿠폰 2,000 − 포인트 1,020 = 24,330, floor(486.6)=486.
- 기각한 가설: 비율 상수만 바꾸면 된다 — 547P가 나와 486P와 다르므로 기각.

## 변경 요약
- src/config.js — `POINT_RATE_PERCENT` 1→2, 환불 회수용 `REFUND_RECOVERY_RATE_PERCENT = 1` 추가
- src/points/earn.js — `pointsFor(amounts)` 추가(배송비 제외 상품 금액, 버림). `earnPoints`가 사용
- src/gift/gift-points.js — `pointsFor` 사용 (일반·선물이 같은 기준)
- src/orders/refund.js — 회수 비율을 `REFUND_RECOVERY_RATE_PERCENT`로 바꿔 기존 1%·반올림 계산 유지
- (기존 테스트 변경) test/order.test.js — 50,000원 주문 적립 기대 500→1000 (2% 반영)
- (기존 테스트 변경) test/gift.test.js — 30,000원 선물 적립 기대 300→600 (2% 반영)
- test/earn-rate.test.js — 새 테스트 추가

## 재현 테스트
- 위치: test/earn-rate.test.js (O-1107 486P, 선물하기 486P, 저장된 주문 불변, 환불 131P 유지)
- 수정 전: 실패 (`git checkout -- src` 후 `npm test`: 새 테스트 3건 + 기존 변경 2건 실패, 환불 테스트는 통과)
- 수정 후: 통과 (`npm test`: 24 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 24 통과, 0 실패
- 실패 항목: 없음. 영수증 출력(`src/format/`)은 변경 없음, test/receipt.test.js 통과
