---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립도 `earnPoints`에 위임해 같은 규칙으로 통일"
    why: "intent 원하는 결과: 선물하기 주문 포함 같은 기준"
    by: ai
  - what: "부분 환불 포인트 회수(`src/orders/refund.js:34`)는 이번에 바꾸지 않음"
    why: "intent의 적립 계산 범위가 아니고 범위를 넓히게 됨"
    by: ai
assumptions:
  - "선물하기 주문도 같은 적립 규칙을 따른다(intake 가정 유지)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불의 회수 포인트는 아직 `percentOf`(반올림, 결제액 기준)라 적립(버림)보다 1P 많게 회수될 수 있음"
  - "적립 안내 원문을 확인하지 못함. O-1042 한 건에 맞춘 규칙임"
recommended_next: null
knowledge_candidates:
  - "적립 포인트 규칙: 상품 − 쿠폰 − 사용 포인트(배송비 제외)의 적립률, 원 단위 버림 (사람)"
  - "적립 계산은 `src/points/earn.js`의 `earnPoints` 하나로 모으고 선물하기도 이를 씀. 부분 환불 회수(`src/orders/refund.js`)는 아직 반올림 규칙"
---
## 요약
적립 포인트를 배송비 제외 기준, 버림으로 계산하게 고쳤다. O-1042는 237P. 일반·선물하기 주문이 같은 함수를 쓴다. `npm test` 24개 통과.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `earnBase`, `earnPoints`. `src/money.js`: `percentOfFloor`.
- 새 테스트 `test/earn.test.js`. 기존 테스트는 변경 없음.
- `src/orders/refund.js:34` 회수 포인트는 그대로(반올림). verify에서 확인 바람.
