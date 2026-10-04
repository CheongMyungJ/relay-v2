## 재현
- 재현 절차: 워크트리에서 `node -e "import('./src/orders/order.js').then(async m=>{const fs=await import('fs');const o=m.createOrder(JSON.parse(fs.readFileSync('examples/O-1107.json')));console.log(o.amounts,o.points)})"`
- 결과: 재현됨
- 기대: `points.earned` = 486 (24,330원의 2% 버림)
- 실제: 273 (`total` 27,330원의 1% 반올림). 율만 2로 올려도 `total`(배송비 포함) 반올림이라 547이 된다

## 원인
- 원인: 적립률이 `POINT_RATE_PERCENT = 1`이고, `earnPoints`/`giftPoints`가 배송비를 포함한 `amounts.total`에 반올림(`percentOf`)을 쓴다. 또 `refund.js`가 같은 상수를 직접 써서, 상수만 2로 바꾸면 환불 회수도 함께 바뀐다.
- 근거: `src/config.js:9`, `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`, `src/money.js` `percentOf`(Math.round). 위 명령 출력 273. 수정 전 새 테스트 2개 실패, 수정 후 통과.
- 사람 추정 판정: 없음
- 기각한 가설: 상수만 2로 변경 — O-1107이 547P가 되어 기대(486)와 다르고 환불 회수 비율도 바뀌어 비목표 위반

## 변경 요약
- `src/config.js` — `POINT_RATE_PERCENT`를 2로. 환불 회수용 `REFUND_RECOVER_RATE_PERCENT = 1` 추가(정산팀과 따로 정할 때까지 이전 값 유지)
- `src/money.js` — 원 단위 미만 버림 `floorPercentOf` 추가
- `src/points/earn.js`, `src/gift/gift-points.js` — `(total - shipping)`의 율%를 버림 (팀 지식 earn-rule.md)
- `src/orders/refund.js` — 회수 비율을 `REFUND_RECOVER_RATE_PERCENT`로 (계산 결과 동일, 반올림 유지)
- (기존 테스트 변경) `test/order.test.js` — 50,000원 주문 적립 기대값 500 → 1000 (2%)
- (기존 테스트 변경) `test/gift.test.js` — 30,000원 선물 적립 기대값 300 → 600 (2%)
- `src/format/`은 변경 없음. 저장된 `points.earned`를 다시 계산하는 코드는 없다(`cancelOrder`는 저장값 사용).

## 재현 테스트
- 위치: `test/earn.test.js` (O-1107 → 486, 버림, 환불 회수 1% 유지)
- 수정 전: 실패 (`node --test test/earn.test.js` → pass 1 / fail 2; 환불 회수 가드 테스트는 원래 통과)
- 수정 후: 통과 (`node --test test/earn.test.js` → pass 3 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 23개 통과, 0 실패
- 실패 항목: 없음 (수정 중 기대값이 바뀐 기존 테스트 2개는 위처럼 갱신)
