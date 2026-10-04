## 재현
- 재현 절차: `node src/cli.js examples/R-0311.json --order examples/O-1077.json`
- 결과: 재현됨
- 기대: 회수 132P (403 − 271)
- 실제: 회수 131P

## 원인
- 원인: `createRefund`가 회수 포인트를 환불 상품 금액(13,130원)의 1% 반올림(`percentOf`)으로 따로 계산했다. 쿠폰·사용 포인트를 반영한 기준 금액의 전후 적립 차이(버림)가 아니다.
- 근거: `src/orders/refund.js:34`(수정 전). 기준 금액 40,310 → 403P, 환불 후 27,180 → 271P(버림)이므로 132P. 반올림 차이면 403−272=131. 수정 전 CLI가 131, 수정 후 132를 출력.
- 사람 추정 판정: 원인은 `src/orders/refund.js`의 회수 계산일 것 — 맞음 — 해당 줄이 원인이고 수정 후 값이 맞다.
- 기각한 가설: 없음

## 변경 요약
- `src/points/earn.js` — `earnBase`(상품 − 쿠폰 − 사용 포인트, 배송비 제외)와 `pointsForBase`(1% 버림) 추가. 기존 `earnPoints`는 바꾸지 않음(적립 방식은 이번 범위 밖).
- `src/orders/refund.js` — 회수 포인트를 환불 전 기준 적립 − 환불 후 기준 적립으로 계산. `refundAmount`와 `cancelOrder`는 그대로.
- `test/refund-points.test.js` — 새 테스트 파일(기존 테스트 변경 없음).

## 재현 테스트
- 위치: `test/refund-points.test.js` (R-0311 = 132P, 나눠 환불한 합 = 전체 환불 176P)
- 수정 전: 실패 (`npm test` → 22개 중 2개 실패, 18·19번)
- 수정 후: 통과 (`npm test` → 22 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 22 pass, 0 fail
- 실패 항목: 없음
