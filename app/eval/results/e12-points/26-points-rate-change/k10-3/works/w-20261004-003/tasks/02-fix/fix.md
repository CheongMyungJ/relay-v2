## 재현
- 재현 절차: `node -e "import('./src/index.js').then(m=>console.log(m.createOrder(JSON.parse(require('fs').readFileSync('examples/O-1107.json'))).points))"` (기준 커밋). 율만 2%로 바꾼 뒤 같은 명령도 실행
- 결과: 재현됨
- 기대: O-1107 적립 486P (기준 24,330원 × 2% 버림)
- 실제: 1%에서 273P, 율만 2%로 바꾸면 547P

## 원인
- 원인: 적립이 `order.amounts.total`(배송비 포함, 포인트 차감 후 27,330원)을 기준으로 하고 `percentOf`로 반올림해서, 율만 올리면 486이 아니라 547이 된다. 팀 지식의 적립 기준(배송비 제외, 버림)이 이 브랜치에 없다(앞 Work 머지 대기).
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`가 `amounts.total`과 `percentOf`(반올림, `src/money.js`)를 쓴다. 기준 커밋의 코드를 복사해 율만 2%로 바꿔 실행하면 547이 나온다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- `src/config.js` — `POINT_RATE_PERCENT` 1→2. 환불 회수용 `REFUND_RECOVERY_RATE_PERCENT = 1`을 새로 둠
- `src/points/earn.js` — `earnBase`(상품−쿠폰−사용 포인트), `pointsForBase`(버림), `earnPoints`를 팀 지식 기준으로 구현
- `src/gift/gift-points.js` — `earnPoints`를 그대로 씀
- `src/orders/refund.js` — 로직은 그대로, 율 상수만 `REFUND_RECOVERY_RATE_PERCENT`로 바꿔 회수 계산이 변하지 않게 함. 사람이 "환불 회수 로직은 건드리지 말고 신규 적립률만 2%로" 하라고 해서 부분 환불 회수 규칙(저장된 earned − 남은 적립)도 이번에 적용하지 않았다
- `README.md` — 적립 기준과 2% 안내
- (기존 테스트 변경) `test/order.test.js:26` — 저장 적립 500→1000 (50,000원 × 2%)
- (기존 테스트 변경) `test/gift.test.js:14` — 선물 적립 300→600 (30,000원 × 2%)

## 재현 테스트
- 위치: `test/earn-rate.test.js` (O-1107 → 486P, 환불 회수가 기존 1% 계산 유지)
- 수정 전: 실패 (기준 코드 복사본에서 `node --test test/earn-rate.test.js`: 486 기대, 273 실제. 율만 2%로 바꾸면 547, 환불 회수는 100 기대 200 실제)
- 수정 후: 통과 (`npm test` 22개 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0 실패
- 실패 항목: 없음
