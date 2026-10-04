## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P (28,270 − 3,000 − 1,500 = 23,770원의 1%, 버림)
- 실제: 268P

## 원인
- 원인: 적립 기준을 `order.amounts.total`(배송비 포함)로 잡고 `percentOf`(반올림)로 계산했다. 선물하기와 부분 환불 회수도 같은 식을 복사해 썼다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`(수정 전). O-1042는 total 26,770 → 267.7 → 268P. 수정 전 코드로 되돌려 새 테스트를 돌리면 5개 중 4개 실패, 수정 후 모두 통과. "다른 주문도 조금씩 많다"는 배송비 포함(+최대 3,000원분)과 반올림 때문이며, 무료 배송이고 소수점이 없는 주문은 원래도 맞아 재현되지 않는다.
- 사람 추정 판정: 없음 (추가 의견은 증상 보고뿐이며 원인은 위 설명으로 포괄됨)
- 기각한 가설: 없음

## 변경 요약
- `src/money.js` — 버림 도우미 `floorPercentOf` 추가
- `src/points/earn.js` — `earnBase`(상품 − 쿠폰 − 사용 포인트)와 `earnOn`(적립률%, 버림)을 두고 `earnPoints`가 사용
- `src/gift/gift-points.js` — `earnPoints`에 위임해 일반 주문과 같은 규칙
- `src/orders/refund.js` — 부분 환불 회수 = (환불 전 남은 주문의 적립분) − (환불 뒤 남은 주문의 적립분). 여러 번 환불해도 합이 남은 주문의 적립분과 맞는다. 전체 취소는 저장된 적립을 그대로 회수(변경 없음)

## 재현 테스트
- 위치: `test/earn-rule.test.js` (배송비 있음/무료 배송, 버림, 선물하기, 부분 환불 2회, 전체 취소)
- 수정 전: 실패 — `git checkout daeeb91 -- src` 후 `node --test test/earn-rule.test.js`: 6개 중 5개 실패(무료 배송 테스트는 수정 전에도 통과: 배송비가 없어 차이가 없기 때문)
- 수정 후: 통과 — `npm test`: 26개 통과, 0 실패

## 테스트 실행
- 명령: `npm test`
- 결과: 26개 통과 / 0 실패. `node src/cli.js examples/O-1042.json` → 적립 예정 237P
- 실패 항목: 없음
