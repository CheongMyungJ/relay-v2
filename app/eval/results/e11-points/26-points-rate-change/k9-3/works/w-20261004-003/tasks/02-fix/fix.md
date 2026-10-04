## 재현
- 재현 절차: `examples/O-1107.json`을 `createOrder`에 넣고 `points.earned` 확인 (`test/earn-rate.test.js`). 비율만 2%로 바꾼 경우도 계산해 봄.
- 결과: 재현됨
- 기대: O-1107 적립 486P (24,330원 × 2%, 배송비 제외, 버림)
- 실제: 기준 커밋 273P (결제 금액 27,330원 × 1%, 반올림). 비율만 2%로 바꾸면 547P.

## 원인
- 원인: 비율이 `POINT_RATE_PERCENT = 1`이고, 적립 계산이 `order.amounts.total`(배송비 포함)에 `percentOf`(반올림)를 쓴다. 팀 지식의 `earnFromAmounts`는 앞 Work 소속이라 이 브랜치에 없다. 환불 회수도 같은 상수를 써서 상수만 바꾸면 회수율까지 2%가 된다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`. 기준 커밋을 복사해 새 테스트를 돌리면 O-1107과 선물 모두 273P. 실험: 수정 전후 테스트 결과 비교.
- 사람 추정 판정: 없음
- 기각한 가설: 비율 상수만 변경 — 547P가 되어 목표(486P) 불일치, 환불 회수도 2%로 바뀜

## 변경 요약
- `src/config.js` — `POINT_RATE_PERCENT` 2로 변경, 환불 회수율 `REFUND_RECOVER_RATE_PERCENT = 1` 추가
- `src/points/earn.js` — `earnFromAmounts` 추가 (상품 − 쿠폰 − 사용 포인트, 배송비 제외, 버림). `earnPoints`가 이 함수를 쓴다
- `src/gift/gift-points.js` — 같은 함수 사용
- `src/orders/refund.js` — 회수율을 `REFUND_RECOVER_RATE_PERCENT`로 분리해 환불 회수 계산을 그대로 유지
- `src/index.js`, `README.md` — export와 설명 갱신
- (기존 테스트 변경) `test/order.test.js` — 적립 기대값 500 → 1000 (2% 적용). 입력은 그대로
- (기존 테스트 변경) `test/gift.test.js` — 적립 기대값 300 → 600 (2% 적용). 입력은 그대로
- 사람 결정: 앞 Work 머지를 기다리지 않고 이 브랜치에서 기준(배송비 제외·버림)도 구현한다 (적립 규정은 원래 그 기준이고 바뀌는 건 비율뿐이라고 사람이 답함)
- 저장된 `points.earned`는 다시 계산하는 코드가 없고 `cancelOrder`가 그대로 쓴다. `src/format/`은 건드리지 않았다.

## 재현 테스트
- 위치: `test/earn-rate.test.js`
- 수정 전: 실패 (기준 커밋 복사본에서 `node --test test/earn-rate.test.js`: O-1107, 선물 모두 expected 486 / actual 273. 환불 테스트는 통과)
- 수정 후: 통과 (`npm test`, 24개 모두 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0개 실패
- 실패 항목: 없음
