## 재현
- 재현 절차: `node -e "import('./src/orders/order.js').then(async m=>{const o=JSON.parse(require('fs').readFileSync('examples/O-1107.json'));console.log(m.createOrder(o).points.earned)})"` 또는 `npm test`(추가한 `test/earn-rate.test.js`)
- 결과: 재현됨
- 기대: O-1107 `points.earned` 486 (상품 27,350 − 쿠폰 2,000 − 포인트 1,020 = 24,330의 2% 버림)
- 실제: 수정 전 설정 1%에서 273 (total 27,330 기준 반올림). 상수만 2로 올려도 547이라 기대와 다름

## 원인
- 원인: (1) `POINT_RATE_PERCENT`가 1. (2) 이 브랜치의 `earnPoints`가 결제 금액(total, 배송비 포함·포인트 차감)을 `percentOf`(반올림)로 계산해 팀 기준(상품−쿠폰−사용 포인트, 버림)과 다름. (3) 부분 환불 회수가 환불 상품 금액의 %라 저장된 적립과 어긋남.
- 근거: `src/config.js:9`, `src/points/earn.js`, `src/orders/refund.js`(pointsRecovered), `src/money.js` percentOf = Math.round. 수정 전 재현 테스트 5개 실패(위 실제값). 수정 전 src로 되돌려 실험해 실패, 수정 후 통과 확인.
- 사람 추정 판정: 없음
- 기각한 가설: 상수만 2로 변경 — O-1107이 547이 되어 486과 다름(기준식·반올림 문제가 남음)

## 변경 요약
- src/config.js — 적립률 2, 옛 주문용 `LEGACY_POINT_RATE_PERCENT = 1` 추가
- src/money.js — 버림 `floorPercentOf` 추가
- src/points/earn.js — `earnFromBasis`(상품−쿠폰−사용 포인트, 배송비 제외, 버림) 추가, `earnPoints`가 사용
- src/orders/order.js — 주문에 `points.ratePercent` 저장
- src/orders/refund.js — 부분 환불 회수 = (저장된 적립 또는 이전 부분 환불 뒤 재계산 적립) − 남은 상품 재계산 적립, 0 미만이면 0. 적립률은 주문에 저장된 값, 없으면 1%. 전체 취소는 그대로 저장값 회수.
- src/gift/gift-points.js — 변경 없음(결제 금액 반올림·배송비 포함 유지, 비율만 상수를 따라 2%)
- (기존 테스트 변경) test/order.test.js — 적립 기대값 500→1000 (2%)
- (기존 테스트 변경) test/gift.test.js — 300→600 (2%)
- (기존 테스트 변경) test/refund.test.js — 픽스처 earned 500→1000, ratePercent 2 추가, 부분 환불 회수 100→200, 전체 취소 500→1000 (새 비율에 맞춘 값만 수정)

## 재현 테스트
- 위치: test/earn-rate.test.js
- 수정 전: 실패 (src를 기준 커밋 상태로 두고 `npm test`: 27개 중 8개 실패, 재현 테스트 5개 포함)
- 수정 후: 통과 (`npm test`: 27개 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 27개 통과, 0 실패 (`src/format/` 변경 없음)
- 실패 항목: 없음 (수정 전 실패 8개는 이번 수정으로 해소, 기준 커밋에서는 기존 20개 통과)
