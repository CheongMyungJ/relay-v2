## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json` 또는 `createOrder(examples/O-1042.json).points.earned` 확인
- 결과: 재현됨
- 기대: 237P (23,770원의 1% 버림)
- 실제: 268P (26,770원의 1% 반올림)

## 원인
- 원인: `earnPoints`가 배송비를 포함한 결제 금액 `amounts.total`에 `percentOf`(반올림)를 적용한다. 기준 금액에 배송비가 들어가고 반올림이라 고객센터 기준보다 커진다.
- 근거: `src/points/earn.js:6` 수정 전 코드, `src/money.js:13` `percentOf`의 `Math.round`. O-1042: total 26,770 → 268. 배송비 0인 O-1077은 total에 배송비가 없어 값이 맞는 쪽(423)이며, 배송비 있는 O-1042·O-1107에서만 틀린 것과 일치. 수정 후 237 확인(실험).
- 사람 추정 판정: `src/points/earn.js` 쪽이 원인 — 맞음 — 위 코드가 직접 원인
- 기각한 가설: `percentOf` 자체를 버림으로 바꾸기 — `src/gift/gift-points.js`(선물, 비목표)와 `src/orders/refund.js`도 쓰므로 영향이 번져 기각

## 변경 요약
- src/points/earn.js — 기준 금액을 `goods − coupon − pointsUsed`로 하고 `Math.floor`로 1% 계산(배송비 제외, 버림). `percentOf`는 그대로 둠
- test/earn.test.js — 새 테스트 3개(O-1042 237P, 배송비 유/무, 소수점 버림)

## 재현 테스트
- 위치: test/earn.test.js
- 수정 전: 실패 (`node --test test/earn.test.js` → pass 0, fail 3)
- 수정 후: 통과 (같은 명령, `npm test` 전체 pass 23, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 23개 통과, 0 실패 (기존 20 + 신규 3)
- 실패 항목: 없음
