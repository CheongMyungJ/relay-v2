## 재현
- 재현 절차: 작업 디렉터리에서 `examples/O-1107.json`, `examples/G-0213.json`을 읽어 `createOrder`, `createGiftOrder`로 주문을 만들고 `points`를 출력한다 (임시 스크립트, 커밋하지 않음).
- 결과: 재현됨
- 기대: O-1107 `points.earned` = 486, G-0213 = 437 (2%, 배송비 제외, 버림).
- 실제: O-1107 → 273 (배송비 포함 30,350 × 1% 반올림), G-0213 → 249.

## 원인
- 원인: `earnPoints`(`src/points/earn.js`)와 `giftPoints`(`src/gift/gift-points.js`)가 각각 `amounts.total`(배송비 포함)에 `percentOf`(반올림)를 써서 규정과 다르고, 식이 두 곳에 복사돼 있었다. 적립률 상수는 1이었다. 상수 `POINT_RATE_PERCENT`는 `src/orders/refund.js:34`도 써서, 상수만 올리면 환불 회수도 2%가 된다.
- 근거: 재현 출력, 코드 확인. 수정 전 `src`를 되돌려 새 테스트가 실패함을 확인.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/points/earn.js — `earnBase`(상품−쿠폰−사용 포인트)와 `earnOn`(버림) 추가, `earnPoints`가 이를 사용.
- src/gift/gift-points.js — `earnPoints`에 위임해 계산식을 한 곳으로 모음.
- src/config.js — `POINT_RATE_PERCENT` 1→2, 환불 회수용 `REFUND_RECOVERY_RATE_PERCENT = 1` 추가.
- src/orders/refund.js — 회수 비율에 새 상수를 쓰도록 import와 한 줄만 변경 (동작 그대로 1%). 사람이 "환불 회수는 1% 유지, 환불 쪽에 상수를 따로 두는 최소 변경"을 허락했다.
- (기존 테스트 변경) test/order.test.js — 적립 기대값 500→1000 (2% 반영).
- (기존 테스트 변경) test/gift.test.js — 적립 기대값 300→600 (2% 반영).
- test/refund.test.js, `src/format/`은 바꾸지 않았다.

## 재현 테스트
- 위치: test/earn.test.js (O-1107=486, G-0213=437)
- 수정 전: 실패 (`src`를 기준 커밋으로 되돌리고 `npm test`: 4 실패 — earn 2개, 기존 테스트 2개)
- 수정 후: 통과 (`npm test`: 22개 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 실패 0
- 실패 항목: 없음
