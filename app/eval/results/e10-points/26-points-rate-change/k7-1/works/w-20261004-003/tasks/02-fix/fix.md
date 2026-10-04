## 재현
- 재현 절차: `node src/cli.js examples/O-1107.json`
- 결과: 재현됨
- 기대: 적립 예정 486P ((27,350 − 2,000 − 1,020) = 24,330원의 2% 버림)
- 실제: 273P (결제 금액 27,330원의 1% 반올림)

## 원인
- 원인: 적립률이 1%이고(`src/config.js:9`), 적립 계산이 배송비 포함 결제 금액(`amounts.total`)에 반올림(`percentOf`)을 쓰며, 주문(`earn.js`)·선물(`gift-points.js`)·환불 회수(`refund.js`)가 각자 계산을 복제하고 있었다.
- 근거: 수정 전 O-1107 실행 결과 273P. 2%만 올려도 27,330×2% = 546.6 → 547P로 486P가 안 나온다. 기준 규칙(배송비 제외·버림)은 팀 지식(앞 Work w-20261004-001, 머지 대기)에만 있고 이 브랜치 코드에는 없다.
- 사람 추정 판정: 없음
- 기각한 가설: 상수만 2로 바꾸면 된다 — 547P가 나와 완료조건(486P)을 못 맞춘다.

## 변경 요약
- src/config.js — POINT_RATE_PERCENT 1 → 2. 부분 환불 회수율 `REFUND_RECOVERY_RATE_PERCENT = 1`을 새로 두어 기존 동작을 유지한다
- src/points/earn.js — `earnOn(goods, coupon, pointsUsed)` 추가: (상품 − 쿠폰 − 사용 포인트)의 률% 버림. `earnPoints`는 이것을 쓴다
- src/gift/gift-points.js — `earnPoints`에 위임(복제 제거)
- src/orders/refund.js — 회수 계산식은 그대로, 적립률 상수 대신 회수율 상수를 쓴다 (사람 지시: 환불 회수는 이번 범위 밖, 정산팀과 따로 결정)
- (기존 테스트 변경) test/order.test.js, test/gift.test.js — 1% 기댓값(500, 300)을 2% 기준(1000, 600)으로 바꿨다. test/refund.test.js는 바꾸지 않았다

## 재현 테스트
- 위치: test/earn.test.js (earnOn 486, O-1107 주문 486, 선물 486, R-0311 회수 131P 유지)
- 수정 전: 실패 (`npm test` → `not ok 2 - test/earn.test.js`, earnOn 없음)
- 수정 후: 통과 (`npm test` → pass 24, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0개 실패. `node src/cli.js examples/O-1107.json` → 486P, R-0311 회수 131P
- 실패 항목: 없음 (기준 커밋에서도 20개 모두 통과)
