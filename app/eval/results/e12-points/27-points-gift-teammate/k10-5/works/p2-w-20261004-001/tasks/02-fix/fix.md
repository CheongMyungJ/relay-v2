## 재현
- 재현 절차: `examples/G-0213.json`을 `createGiftOrder`에 넣고 `order.points.earned`를 출력 (`node /tmp/r.mjs` 형태의 스크립트)
- 결과: 재현됨
- 기대: 218P (24,860 − 2,000 − 1,000 = 21,860, 1% = 218.6 → 218)
- 실제: 249P

## 원인
- 원인: `giftPoints`가 결제 금액(`amounts.total` = 24,860)에 공용 `percentOf`(반올림)를 적용했다. 쿠폰·사용 포인트가 기준에서 빠지고 반올림까지 해서 어긋났다.
- 근거: `src/gift/gift-points.js`의 `percentOf(order.amounts.total, ...)`. 실행 출력 amounts = {goods 24860, coupon 2000, shipping 3000, pointsUsed 1000, total 24860}, earned 249 (24,860 × 1% = 248.6 → 249). 수정 후 218로 바뀌는 것을 확인.
- 사람 추정 판정: 요청이 `src/gift/gift-points.js` 확인을 지목 — 맞음. 그 파일이 원인 위치다.
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — 일반 주문의 `earnPoints`를 그대로 호출하게 바꿈. 기준 금액과 내림 규칙을 한 곳에 둔다. `percentOf`는 건드리지 않음.
- test/gift.test.js — G-0213 재현 테스트 추가 (기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/gift.test.js 마지막 테스트
- 수정 전: 실패 (`node --test test/gift.test.js` → expected 218, actual 249)
- 수정 후: 통과 (`npm test` → 22개 모두 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: tests 22, pass 22, fail 0
- 실패 항목: 없음
