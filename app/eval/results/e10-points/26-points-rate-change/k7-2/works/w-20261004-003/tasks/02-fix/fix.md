## 재현
- 재현 절차: `node src/cli.js examples/O-1107.json | grep 적립`
- 결과: 재현됨
- 기대: 적립 예정 486P (24,330원 × 2%, 버림)
- 실제: 273P (배송비 포함 total 27,330원 × 1%, 반올림)

## 원인
- 원인: `earnPoints`가 배송비가 든 `amounts.total`에 공용 `POINT_RATE_PERCENT`(1%)를 `percentOf`(반올림)로 적용한다. 일반 주문 전용 2% 상수가 없고, 상수를 올리면 선물·환불도 같이 바뀐다.
- 근거: `src/points/earn.js:6`(수정 전), `src/config.js:9`, 사용처 `src/gift/gift-points.js:6`, `src/orders/refund.js:34`. 수정 전 CLI 273P. 수정 뒤 486P. `src/` 변경을 되돌리면 새 테스트가 실패함을 확인.
- 사람 추정 판정: `POINT_RATE_PERCENT`는 선물·환불도 쓰므로 고려해야 한다 — 맞음 — config.js:9와 gift-points.js:6, refund.js:34에서 확인. 일반 주문 전용 상수를 따로 추가함.
- 기각한 가설: `POINT_RATE_PERCENT`를 2로 올림 — 선물하기·환불 회수까지 바뀌어 비목표 위반.

## 변경 요약
- src/config.js — 일반 주문 전용 `ORDER_POINT_RATE_PERCENT = 2` 추가. 기존 `POINT_RATE_PERCENT`(1)는 유지.
- src/points/earn.js — (상품 − 쿠폰 − 사용 포인트) × 2%를 `Math.floor`로 계산(배송비 제외, 버림). `percentOf`는 바꾸지 않음.
- test/order.test.js — O-1107 재현 테스트 추가.
- (기존 테스트 변경) test/order.test.js — '적립 포인트를 주문에 저장한다'의 기대값 500 → 1000 (50,000원 주문, 1% → 2% 규정 변경 반영).

## 재현 테스트
- 위치: test/order.test.js 'O-1107: 적립은 …2%를 버림한다'
- 수정 전: 실패 (`src/`만 되돌려 `npm test` → 15번 O-1107 테스트와 13번 기존 적립 테스트 실패, pass 19 / fail 2)
- 수정 후: 통과 (`npm test` → pass 21 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 21개 통과, 0개 실패
- 실패 항목: 없음
