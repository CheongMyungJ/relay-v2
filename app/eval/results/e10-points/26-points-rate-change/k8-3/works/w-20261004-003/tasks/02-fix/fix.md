## 재현
- 재현 절차: `examples/O-1107.json`을 `createOrder`로 만들어 `points`를 출력 (임시 스크립트, 저장소에는 남기지 않음)
- 결과: 재현됨
- 기대: `points.earned` = 486 (24,330원 × 2% = 486.6 → 버림)
- 실제: 적립률 1%인 현재 코드에서 273 (배송비 포함 결제액 27,330 × 1% 반올림). 비율만 2%로 바꾸면 547이라 규정과도 어긋남

## 원인
- 원인: 적립 계산(`earnPoints`, `giftPoints`)이 배송비 포함 결제액(`amounts.total`)을 `percentOf`(반올림)로 계산해 규정(상품 − 쿠폰 − 사용 포인트, 버림)과 달랐고, 환불 회수(`refund.js`)가 적립률 상수를 직접 써서 상수를 올리면 회수도 따라 바뀌는 구조였다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`이 `amounts.total` + `percentOf`(`src/money.js:13`, Math.round) 사용. `src/orders/refund.js:34`가 `POINT_RATE_PERCENT` 사용. 수정 전 O-1107 실행 결과 273. 수정 후 486.
- 사람 추정 판정: 없음 (추가 의견은 O-1107 계산 설명이며 실제 계산과 일치함을 확인)
- 기각한 가설: 부분 환불 회수에도 2% 적용 — 사람이 범위 밖이라고 정정함

## 변경 요약
- src/config.js — `POINT_RATE_PERCENT` 1→2, 회수용 `POINT_RECOVER_RATE_PERCENT = 1` 추가
- src/money.js — 원 단위 버림 `floorPercentOf` 추가 (`percentOf`는 그대로)
- src/points/earn.js — 기준 금액을 상품 − 쿠폰 − 사용 포인트로, 버림 적용
- src/gift/gift-points.js — `earnPoints`를 호출해 일반 주문과 같은 계산 사용
- src/orders/refund.js — 회수 비율을 `POINT_RECOVER_RATE_PERCENT`(1%)로 바꿈. 계산 방식(`percentOf` 반올림)은 그대로
- (기존 테스트 변경) test/order.test.js — '적립 포인트를 주문에 저장한다' 기대값 500→1000 (50,000원 × 2%, 검증 강도 같음)
- (기존 테스트 변경) test/gift.test.js — 선물 적립 기대값 300→600 (30,000원 × 2%)

## 재현 테스트
- 위치: test/order.test.js (O-1107 → 486), test/gift.test.js (선물하기 동일 조건 → 486)
- 수정 전: 실패 — `npm test` 4건 실패(5, 6, 14, 15번), 통과 18
- 수정 후: 통과 — `npm test` 22건 모두 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 22 통과, 0 실패
- 실패 항목: 없음 (영수증·환불 테스트는 변경 없이 통과)
