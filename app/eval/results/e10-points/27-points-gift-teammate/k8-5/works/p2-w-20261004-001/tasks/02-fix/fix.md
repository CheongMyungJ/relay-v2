## 재현
- 재현 절차: `node -e "import('./src/gift/gift-order.js').then(m=>console.log(m.createGiftOrder(JSON.parse(require('fs').readFileSync('examples/G-0213.json'))).points))"`
- 결과: 재현됨
- 기대: earned 218 (total 24860 − 배송비 3000 = 21860 → 1% 버림)
- 실제: earned 249 (total 24860 × 1% = 248.6 → 반올림 249)

## 원인
- 원인: 선물 주문은 `src/gift/gift-order.js:36`에서 옛 식인 `giftPoints`(배송비 포함, 반올림)를 써서, 앞서 `earnPoints`(배송비 제외, 버림)로 고친 일반 주문과 식이 갈라졌다.
- 일반 주문과 달랐던 이유: 일반 주문(`src/orders/order.js:35`)은 `earnPoints`, 선물 주문은 `giftPoints`를 쓴다. 금액 계산(`orderAmounts`)은 같다. 배송비가 0이고 1% 값이 정수인 주문(예: 테스트의 30000원 → 300P)은 두 식이 같아 드러나지 않는다. G-0213은 배송비 3000원과 .6 소수 때문에 31P 가까이 차이가 난다(249 vs 218).
- 근거: 수정 전 재현 출력 249, 수정 후 218. 호출부만 바꿔 값이 바뀌었으므로 원인이 호출 식임을 실험으로 확인했다.
- 사람 추정 판정: 없음
- 기각한 가설: 금액(`amounts`) 계산 차이 — 선물 주문도 `orderAmounts`를 그대로 쓰고 total이 일반 주문과 같다.

## 변경 요약
- src/gift/gift-order.js — `giftPoints` 대신 `earnPoints`로 `points.earned`를 계산. `gift-points.js`, `percentOf`, 영수증, 이미 저장된 주문은 건드리지 않았다.
- test/gift.test.js — G-0213 재현 테스트 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/gift.test.js `G-0213: 적립 예정 포인트는 ...`
- 수정 전: 실패 (`npm test` — expected 218, actual 249, fail 1)
- 수정 후: 통과 (`npm test` — pass 25, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 25개 통과, 0개 실패
- 실패 항목: 없음
