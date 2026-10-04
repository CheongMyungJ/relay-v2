---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 배송비를 뺀 결제 금액(total - shipping)의 1% 내림으로 한다"
    why: "O-1042의 237P를 설명하는 유일한 조합이다 (총액 반올림 268, 총액 내림 267, 배송비 제외 반올림 238)"
    by: ai
assumptions:
  - "고객센터 기준은 O-1042 한 건으로만 확인했다. 배송비 제외와 내림이라는 규칙은 그 값에서 추론한 것이다"
  - "O-1107의 기대값 243P는 위 규칙으로 계산한 값이며 고객센터 확인은 없다"
rejected:
  - "총액 1% 내림만 적용: 267이라 237과 다르다"
  - "쿠폰만 빼고 사용 포인트는 빼지 않는 기준: 252라 237과 다르다"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불의 회수 포인트(`src/orders/refund.js:34`)는 상품 금액의 1%를 반올림해 적립 규칙과 다르다. 이번 범위에서 건드리지 않았다"
  - "선물하기 적립(`src/gift/gift-points.js`)은 비목표라 그대로이고 여전히 총액 반올림이다. 일반 주문과 기준이 달라졌다"
  - "O-1077은 이미 저장된 `points.earned`(403)를 쓰는 예시라 재계산하지 않았다"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립 포인트는 배송비를 뺀 결제 금액의 1%를 원 단위 내림한 값이다 (O-1042 = 237P, 고객센터 기준)"
  - "아직 규칙을 따르지 않음: src/gift/gift-points.js — 총액 반올림 기준, 사람이 이번 범위에서 뺌 (사람)"
  - "아직 규칙을 따르지 않음: src/orders/refund.js:34 부분 환불 회수 포인트 — 상품 금액 1% 반올림, 적립 규칙과 불일치 가능"
---
## 요약
`earnPoints`가 배송비 포함 금액을 반올림해 O-1042가 268P로 나왔다. 배송비를 뺀 금액의 1%를 내림하도록 고쳐 237P가 된다. 재현 테스트를 추가했고 `npm test`는 23개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, 테스트: `test/earn.test.js`
- 기대값 근거: O-1042 total 26,770 − 배송비 3,000 = 23,770 → 237.7 → 내림 237
- `src/format/`과 `src/gift/`는 변경 없음
- 환불 회수 포인트(`refund.js:34`)와 선물 적립은 아직 옛 기준(반올림)
