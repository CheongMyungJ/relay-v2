## 재현
- 재현 절차: `node src/cli.js examples/R-0311.json --order examples/O-1077.json`
- 결과: 재현됨
- 기대: 포인트 회수 132P (403 − floor(27,180 × 1%))
- 실제: 131P (13,130원 × 1% = 131.3을 반올림)

## 원인
- 원인: `createRefund`가 원래 적립·쿠폰·사용 포인트를 쓰지 않고 환불 상품 금액에 `percentOf`(반올림)를 적용했다.
- 근거: `src/orders/refund.js`의 `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)`, `src/money.js`의 `percentOf`는 `Math.round`. 수정 전 CLI 출력 131P. 쿠폰·사용 포인트가 없고 딱 떨어지는 기존 테스트(100P)는 우연히 맞아 통과했다.
- 사람 추정 판정: 없음
- 기각한 가설: 올림 — 13,130원 1% 올림은 132지만 정산팀 규칙이 아니라고 사람이 답함(intake)

## 변경 요약
- src/money.js — 버림 도우미 `percentFloor` 추가
- src/orders/refund.js — 회수 = 원래 적립 − 남은 상품 재계산 적립(버림, 쿠폰·사용 포인트 유지, 배송비 제외). 이전 환불이 있으면 그때까지의 회수분(원 적립 − 이번 환불 전 재계산 적립)을 빼 이번 몫만 회수(중복 회수 방지)
- 환불 금액과 영수증 코드는 바꾸지 않음

## 재현 테스트
- 위치: test/refund.test.js (O-1077/R-0311 132P, 여러 번 환불 66P)
- 수정 전: 실패 (`node --test test/refund.test.js` → pass 3, fail 2)
- 수정 후: 통과 (`npm test` → pass 22, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0 실패. CLI 출력은 환불 금액 13,130원 그대로, 회수 132P
- 실패 항목: 없음
