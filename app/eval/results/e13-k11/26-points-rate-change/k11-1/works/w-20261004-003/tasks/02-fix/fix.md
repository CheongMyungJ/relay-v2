## 재현
- 재현 절차: `node src/cli.js examples/O-1107.json` 의 "적립 예정" 확인. 또는 `createOrder(O-1107).points.earned` (테스트 `test/points-rate.test.js`)
- 결과: 재현됨 (2% 변경 전 코드에서 486P가 나오지 않음)
- 기대: 486P (배송비 제외 기준 24,330원 × 2% 버림)
- 실제: 변경 전 273P (결제 금액 27,330원 × 1%). 상수만 2로 바꾸면 546P(배송비 3,000원이 기준에 포함돼 60P 과다)

## 원인
- 원인: 적립률이 `POINT_RATE_PERCENT = 1`이고, `earnPoints`/`giftPoints`가 배송비를 포함한 `amounts.total`에 곱한 뒤 반올림했다. 팀 규칙(배송비 제외, 버림)을 아직 따르지 않는 코드다.
- 근거: `src/config.js:9`, `src/points/earn.js`, `src/gift/gift-points.js`, `src/orders/refund.js:34`(환불 회수는 환불 상품 금액 × 률). O-1107: goods 27,350 − 쿠폰 2,000 − 포인트 1,020 = 24,330, 배송비 3,000, total 27,330. 상수만 바꾸면 546이 나온다고 계산으로 확인(실험은 테스트 실패 출력으로 대체).
- 사람 추정 판정: 없음
- 기각한 가설: 상수만 2로 바꾸면 충분하다 — O-1107이 546P가 되어 완료조건(486)을 못 맞춘다.

## 변경 요약
- src/config.js — `POINT_RATE_PERCENT` 1 → 2
- src/points/earn.js — `earnBase`(상품−쿠폰−사용 포인트), `earnFromBase`(률 적용, 원 단위 버림) 추가, `earnPoints`가 이를 사용 (팀 지식 earn-points-rule)
- src/gift/gift-points.js — `earnPoints`에 위임 (같은 계산)
- src/orders/refund.js — 회수 포인트 = 원 적립 − 남은 상품 재계산 적립 (팀 지식 refund-points-recovery, intent 제약)
- (기존 테스트 변경) test/order.test.js — 적립 기대값 500 → 1000 (2%)
- (기존 테스트 변경) test/gift.test.js — 300 → 600 (2%)
- (기존 테스트 변경) test/refund.test.js — 저장 적립 fixture 500 → 1000, 회수 기대값 100 → 200, 전체 취소 기대값 500 → 1000. 값만 2% 기준으로 맞췄고 검증 항목은 그대로
- `src/format/`, test/receipt.test.js(저장된 주문 290P)는 변경 없음

## 재현 테스트
- 위치: test/points-rate.test.js (O-1107 486P, 버림, 선물하기, 부분 환불 회수)
- 수정 전: 실패 (`npm test` → 4개 not ok: 15~18, pass 20 / fail 4)
- 수정 후: 통과 (`npm test` → pass 24 / fail 0), `node src/cli.js examples/O-1107.json` → 적립 예정 486P

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 모두 통과
- 실패 항목: 없음 (기준 커밋에서도 전부 통과했음)
