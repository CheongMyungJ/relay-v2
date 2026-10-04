## 재현
- 재현 절차: `node src/cli.js examples/O-1107.json | grep 적립` (적립률을 2로 바꾼 상태). 수정 전 코드에서 `POINT_RATE_PERCENT = 2`로 계산하면 `earnPoints`가 total(27,330원)에 반올림을 적용
- 결과: 재현됨
- 기대: 486P (24,330원의 2% = 486.6 → 버림)
- 실제: 547P (배송비 포함 27,330원의 2% = 546.6 → 반올림). 현재 1%에서도 기준액과 반올림이 틀려 있었다

## 원인
- 원인: `earnPoints`가 배송비를 포함한 `amounts.total`에 반올림(`percentOf`)을 써서 기준액과 버림 규칙이 틀리다. 환불 회수(`refund.js`)도 같은 반올림. 선물하기 적립은 같은 상수를 공유해 상수만 올리면 함께 바뀐다.
- 근거: `src/points/earn.js:6`, `src/money.js` percentOf(Math.round), O-1107 amounts: shipping 3000, total 27330. 수정 전 코드에 새 테스트를 돌리면 4건 실패(아래).
- 사람 추정 판정: 상수만 바꾸면 선물하기 적립률도 바뀐다 — 맞음 — `gift-points.js`가 `POINT_RATE_PERCENT`를 직접 import. 비목표(선물하기 계산 방식 불변)에 따라 별도 상수로 분리
- 기각한 가설: 없음

## 변경 요약
- src/config.js — `POINT_RATE_PERCENT` 2로, 선물하기용 `GIFT_POINT_RATE_PERCENT = 1` 추가
- src/money.js — 버림 도우미 `percentOfFloor` 추가
- src/points/earn.js — 기준액 = total − shipping, 버림
- src/orders/refund.js — 회수도 `percentOfFloor`
- src/gift/gift-points.js — 별도 1% 상수 사용(동작 불변)
- (기존 테스트 변경) test/order.test.js — 25,000×2 주문의 적립 기대값 500 → 1000 (1% → 2%)
- (기존 테스트 변경) test/refund.test.js — 부분 환불 회수 100 → 200, 픽스처 earned 500 → 1000, 전체 취소 기대 500 → 1000
- src/format/ 과 저장된 `points.earned` 처리는 건드리지 않음

## 재현 테스트
- 위치: test/order.test.js (O-1107 = 486P), test/refund.test.js (2% 버림 회수), test/gift.test.js (선물하기 1% 유지)
- 수정 전: 실패 (src를 되돌리고 `npm test`: 4건 실패, 통과 19)
- 수정 후: 통과 (`npm test`: 23 통과, 0 실패). `node src/cli.js examples/O-1107.json` 적립 예정 486P, G-0213 적립 249P(1% 유지)

## 테스트 실행
- 명령: `npm test`
- 결과: 23 통과 / 0 실패
- 실패 항목: 없음 (수정 전 기준 커밋은 기존 20건 모두 통과)
