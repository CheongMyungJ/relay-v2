## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P (23,770원의 1%, 배송비 제외, 버림)
- 실제: 268P

## 원인
- 원인: `earnPoints`가 배송비를 포함한 결제 금액(`amounts.total`)에 `percentOf`(반올림)를 적용했다. 배송비 3,000원이 기준에 들어가고 1P 미만을 반올림한다.
- 근거: `src/points/earn.js:6` 수정 전 `percentOf(order.amounts.total, POINT_RATE_PERCENT)`. O-1042 total 26,770 → 267.7 → 268. 배송비가 없고 나누어떨어지는 주문(기존 테스트 O-0002, 50,000원 → 500P)은 결과가 같아 기존 테스트가 통과했다. 수정 후 O-1042는 237P.
- 사람 추정 판정: 요청이 가리킨 위치 `src/points/earn.js` — 맞음 — 적립 계산이 이 파일에 있고 여기를 고쳐 해결됨
- 기각한 가설: 없음

## 변경 요약
- src/points/earn.js — 기준을 `total - shipping`(= 상품 − 쿠폰 − 사용 포인트)으로 하고 `Math.floor`로 버림. 더 쓰지 않는 `percentOf` import 제거.
- test/earn.test.js — 새 파일. 배송비 있음/없음, 버림, O-1042 테스트.

## 재현 테스트
- 위치: test/earn.test.js
- 수정 전: 실패 (`npm test` → 24개 중 3개 실패: 배송비 있는 주문, 버림, O-1042)
- 수정 후: 통과 (`npm test` → 24개 통과, 0 실패)

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0 실패
- 실패 항목: 없음
