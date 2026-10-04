## 재현
- 재현 절차: 워크트리에서 `createRefund(examples/O-1077.json, examples/R-0311.json)` 실행 (node 스크립트로 두 JSON을 읽어 호출)
- 결과: 재현됨
- 기대: pointsRecovered 132 (403 − 271), refundAmount 13,130
- 실제: pointsRecovered 131, refundAmount 13,130

## 원인
- 원인: `createRefund`가 회수 포인트를 환불 상품 금액의 1% 반올림(`percentOf(refundGoods, 1)`)으로 구해, 쿠폰·사용 포인트와 버림을 반영한 "남은 상품 재계산 적립"과 어긋난다.
- 근거: `src/orders/refund.js` 기존 `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)`. 13,130 → 131.3 → 131. 정산팀 규칙은 403 − floor(27,180×1%)=271 → 132. 수정 뒤 132로 바뀌고 테스트 통과(실험 확인).
- 사람 추정 판정: 없음
- 기각한 가설: 환불 상품 금액의 1% 올림 — intake에서 사람이 올림이 아니라고 답함

## 변경 요약
- src/orders/refund.js — 회수 = `order.points.earned` − floor((remainingGoods − coupon − pointsUsed)×rate/100). `percentOf` 사용 제거(공용 함수는 그대로).
- test/refund.test.js — O-1077/R-0311 사례 테스트 추가 (기존 테스트는 변경 없음, 기존 케이스 500−400=100도 그대로 통과).

## 재현 테스트
- 위치: test/refund.test.js '부분 환불 회수 포인트: 저장된 적립 − 남은 상품으로 다시 계산한 적립(버림)'
- 수정 전: 실패 (`npm test` → expected 132, actual 131)
- 수정 후: 통과 (`npm test` → pass 21, fail 0)

## 테스트 실행
- 명령: npm test
- 결과: 21개 통과, 0 실패
- 실패 항목: 없음
