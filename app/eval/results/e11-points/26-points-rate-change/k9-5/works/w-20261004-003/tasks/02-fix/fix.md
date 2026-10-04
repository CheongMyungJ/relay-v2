## 재현
- 재현 절차: `examples/O-1107.json`을 `createOrder`로 만들어 `points.earned`를 본다 (수정 전 소스에서 새 테스트 `test/order.test.js`를 `npm test`로 실행).
- 결과: 재현됨
- 기대: 486P (기준액 24,330원 × 2%, 버림)
- 실제: 수정 전에는 적립률 1%와 배송비 포함 결제금액(27,330) 반올림으로 273P. 비율만 2%로 올리면 547P.

## 원인
- 원인: 적립 계산이 배송비를 포함한 `order.amounts.total`을 `percentOf`(반올림)로 계산했고, 적립률 1%였다. 선물하기(`giftPoints`)와 부분 환불 회수(`refund.js`)는 각자 같은 식을 따로 썼고, 환불은 환불 상품 금액에 비율만 곱했다.
- 근거: `src/points/earn.js`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`(수정 전), `src/config.js:9`. 수정 전 소스에서 새 테스트 5개가 실패, 수정 후 통과.
- 사람 추정 판정: "비율만 올리면 O-1107은 547P가 되어 486P와 다르다" — 맞음 — 27,330 × 2% = 546.6 → 547 (배송비 포함, 반올림).
- 기각한 가설: 비율만 2%로 변경 — 547P가 되어 고객센터 기대값과 팀 지식 규칙에 어긋남.

## 변경 요약
- `src/config.js` — `POINT_RATE_PERCENT` 1 → 2.
- `src/money.js` — 원 단위 버림 `floorPercentOf` 추가.
- `src/points/earn.js` — `earnBase`(상품 − 쿠폰 − 사용 포인트), `earnOnBase`(기준액 × 적립률 버림) 추가, `earnPoints`가 이를 사용.
- `src/gift/gift-points.js` — `earnPoints`를 그대로 사용.
- `src/orders/refund.js` — 부분 환불 회수를 (환불 전 기준액 적립 − 환불 후 기준액 적립)으로 계산. `cancelOrder`와 `src/format/`은 건드리지 않음(저장된 `points.earned` 사용).
- (기존 테스트 변경) `test/order.test.js` 적립 500 → 1000, `test/gift.test.js` 300 → 600, `test/refund.test.js` 회수 100 → 200 — 적립률 1% → 2% 정책 변경에 따른 기대값 갱신. 검증 조건은 그대로.

## 재현 테스트
- 위치: `test/order.test.js`(O-1107 = 486P), `test/refund.test.js`(기준액 차이 회수)
- 수정 전: 실패 (`npm test` — 소스만 되돌린 상태에서 5개 실패: 새 테스트 2개와 기대값을 바꾼 기존 3개)
- 수정 후: 통과 (`npm test` — 22개 통과, 0 실패)

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0 실패
- 실패 항목: 없음
