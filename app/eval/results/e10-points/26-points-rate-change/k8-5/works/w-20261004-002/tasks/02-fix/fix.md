## 재현
- 재현 절차: `createRefund`에 `examples/O-1077.json`과 `examples/R-0311.json`을 넣어 호출 (프로젝트 루트에서 node 스크립트로 JSON을 읽어 실행)
- 결과: 재현됨
- 기대: `pointsRecovered` 132
- 실제: `pointsRecovered` 131 (`refundAmount` 13130)

## 원인
- 원인: `createRefund`가 환불분 금액(13,130원)만 따로 1% 해서 반올림(`percentOf`)했다. 정산팀 기준은 저장된 적립에서 남은 상품으로 다시 계산한 적립을 빼는 방식이라 1P 어긋난다.
- 근거: 수정 전 `src/orders/refund.js:36` `percentOf(refundGoods, POINT_RATE_PERCENT)` → 131.3 → 131. 기준식은 403 − floor(27,180 × 1%) = 403 − 271 = 132. 수정 후 같은 입력에서 132 확인.
- 사람 추정 판정: 없음 (추가 의견은 위치 지정뿐이며 `src/orders/refund.js`가 실제 위치였음)
- 기각한 가설: 없음

## 변경 요약
- src/money.js — 버림 퍼센트 계산 `floorPercentOf` 추가. 기존 `percentOf`(반올림)는 다른 곳에서 쓰므로 그대로 둠.
- src/orders/refund.js — 회수 포인트를 `max(0, order.points.earned − floor((남은 상품 − 쿠폰 − 사용 포인트) × 비율))`로 계산. 배송비 제외, `refundAmount`는 그대로.
- test/refund.test.js — 새 테스트 추가 (기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/refund.test.js '부분 환불: 회수 포인트는 저장된 적립에서 …' (O-1077/R-0311, 132P)
- 수정 전: 실패 (`npm test` → expected 132, actual 131, 20 pass / 1 fail)
- 수정 후: 통과 (`npm test` → 21 pass / 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 21개 통과, 0개 실패
- 실패 항목: 없음 (수정 전 새 테스트만 실패했고 기준 커밋에는 해당 테스트가 없음)
