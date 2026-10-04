---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "버림 도우미 floorPercentOf를 money.js에 추가하고 percentOf는 그대로 둠"
    why: "percentOf는 환불과 선물하기가 쓰므로 동작을 바꾸지 않음"
    by: ai
assumptions:
  - "다른 주문도 같은 기준이 적용된다고 가정 (적립 안내 문서는 레포에 없음)"
rejected:
  - "선물하기 적립이 earnPoints를 공유: giftPoints는 자체 percentOf 호출이라 영향 없음"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수(src/orders/refund.js:34)는 percentOf(refundGoods)로 반올림하며 새 적립 기준(버림, 쿠폰·포인트 차감 후)과 다르다. 의도의 범위 밖이라 손대지 않음. 환불 포인트 회수가 적립보다 많거나 적을 수 있음"
  - "선물하기 적립(giftPoints)은 비목표라 여전히 total 반올림 기준"
recommended_next: null
knowledge_candidates:
  - "적립 기준: 배송비 제외, 쿠폰·포인트 사용 차감 후 상품 금액의 적립률, 원 단위 미만 버림 (사람)"
  - "아직 규칙을 따르지 않음: src/gift/gift-points.js — total 반올림 기준, 사람이 이번 범위에서 뺌 (사람)"
  - "아직 규칙을 따르지 않음: src/orders/refund.js:34 부분 환불 포인트 회수 — 반올림 기준 그대로"
---
## 요약
`earnPoints`를 `goods - coupon - pointsUsed`의 1% 버림으로 고쳤다. O-1042는 268P에서 237P가 된다. 재현 테스트 2개를 추가했고 `npm test` 22개 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:5`: 새 기준, `src/money.js`: `floorPercentOf` 추가
- `src/format/`, `src/gift/gift-points.js` 변경 없음 (`git diff main`으로 확인)
- 부분 환불 회수(`src/orders/refund.js:34`)는 옛 반올림 기준 그대로라 verify에서 판단 필요
- 테스트: `npm test`
