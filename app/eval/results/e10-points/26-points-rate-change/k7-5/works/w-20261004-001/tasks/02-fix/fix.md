## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P (23,770원 × 1% 내림)
- 실제: 268P (결제 금액 26,770원 × 1% 반올림). 같은 방식으로 G-0213 249P(기대 218P), O-1107 273P(기대 243P)도 많게 나옴

## 원인
- 원인: 적립 기준이 배송비를 포함한 `amounts.total`이고 `percentOf`가 반올림이라 적립이 많게 나온다. 일반 주문과 선물하기 주문 둘 다 같은 식을 쓴다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`가 `percentOf(order.amounts.total, ...)` 사용. `src/orders/order.js`의 `total`은 배송비 포함. 배송비 없는 O-1077(423P)은 수정 전후 같고, 배송비 있는 주문만 달라지는 것과 일치. 수정 전 새 테스트 3개 실패, 수정 후 통과(실험 확인).
- 사람 추정 판정: 없음 (적립 기준은 사람이 확인한 결정)
- 기각한 가설: 없음

## 변경 요약
- src/points/earn.js — 기준 금액을 상품−쿠폰−사용 포인트로 바꾸고 내림 (`earnBase` 추가)
- src/gift/gift-points.js — `earnPoints`에 위임해 같은 기준 사용
- test/earn.test.js — 새 테스트 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/earn.test.js
- 수정 전: 실패 (`npm test` → pass 21 / fail 3)
- 수정 후: 통과 (`npm test` → 24 pass / 0 fail)

## 테스트 실행
- 명령: npm test
- 결과: 24개 모두 통과. O-1042 237P, G-0213 218P. 영수증 코드(`src/format/`)와 `refund.js`는 수정하지 않음
- 실패 항목: 없음
