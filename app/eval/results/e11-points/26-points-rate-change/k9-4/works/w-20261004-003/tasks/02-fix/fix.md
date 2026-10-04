## 재현
- 재현 절차: `createOrder(JSON.parse(fs.readFileSync('examples/O-1107.json')))`를 실행해 `points.earned`를 본다 (임시 스크립트, 커밋 안 함)
- 결과: 재현됨
- 기대: 486P ((27350−2000−1020)=24330의 2%, 버림)
- 실제: 273P (amounts.total 27330 = 배송비 3000 포함, 1%, 반올림)

## 원인
- 원인: 적립이 `POINT_RATE_PERCENT=1`에 배송비가 든 `amounts.total`을 `percentOf`(반올림)로 계산했다. 선물하기도 같은 식이었다. 환불 회수는 `POINT_RATE_PERCENT`를 직접 써서, 값만 2로 바꾸면 환불 결과도 달라진다.
- 근거: `src/points/earn.js`(수정 전) `percentOf(order.amounts.total, ...)`, `src/config.js:9`, `src/orders/refund.js:34`. O-1107은 배송비 3000이 붙는 주문이라 total 기준이면 2%여도 546P로 486과 어긋난다(계산). 수정 뒤 486P, R-0311 영수증 출력은 수정 전후 diff 없음.
- 사람 추정 판정: 없음
- 기각한 가설: 비율만 2로 바꾸면 된다 — 배송비 포함 total 기준이라 O-1107이 546P가 되고 환불 회수도 2%로 바뀐다.

## 변경 요약
- `src/config.js` — `POINT_RATE_PERCENT`를 2로. 환불 전용 `REFUND_RECOVER_RATE_PERCENT = 1` 추가
- `src/points/earn.js` — `earnBase`(상품−쿠폰−사용 포인트), `pointsOf`(버림) 추가, `earnPoints`가 이를 사용 (팀 지식 earn-rule.md)
- `src/gift/gift-points.js` — `earnPoints`를 그대로 써서 선물하기도 같은 규칙
- `src/orders/refund.js` — 회수 비율을 `REFUND_RECOVER_RATE_PERCENT`로 분리해 결과 유지
- (기존 테스트 변경) `test/order.test.js` — '적립 포인트를 주문에 저장한다' 기대값 500→1000 (50000원 주문, 1%→2%)
- (기존 테스트 변경) `test/gift.test.js` — 적립 기대값 300→600 (30000원 주문, 1%→2%)
- `src/format/`은 변경 없음, 저장된 `points.earned`를 쓰는 `cancelOrder`도 변경 없음

## 재현 테스트
- 위치: `test/order.test.js` 'O-1107' 테스트
- 수정 전: 실패 (같은 입력으로 273P가 나옴을 위 재현에서 확인. 테스트 파일을 수정 전 코드에 따로 돌리지는 않음)
- 수정 후: 통과 (`npm test` 21개 통과, 486P)

## 테스트 실행
- 명령: `npm test`
- 결과: 21 pass, 0 fail
- 실패 항목: 없음
