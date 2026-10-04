---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 (상품 금액 - 쿠폰 - 사용 포인트)의 1%, 원 미만 버림으로 한다"
    why: "O-1042의 기대값 237P와 맞는 규칙은 이것뿐이다(배송비 포함이면 268P, 반올림이면 238P)"
    by: ai
assumptions:
  - "고객센터 기준의 전체 규칙은 O-1042 한 건에서 역산했다. 배송비 제외와 버림 규칙은 다른 주문으로 확인하지 못했다"
rejected:
  - "배송비 포함 유지: 268P가 되어 기대값과 다르다"
  - "반올림 유지: 238P가 되어 기대값과 다르다"
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(src/gift/gift-points.js)은 비목표라 그대로다. 같은 기준 문제가 남아 있을 수 있어 다른 팀과 논의가 필요하다"
  - "O-1077 예제의 저장된 total은 40,310원인데 CLI로 다시 만들면 42,310원이 나온다. 저장값이라 이번에 건드리지 않았다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 배송비를 제외하고 (상품 금액 - 쿠폰 - 사용 포인트)의 1%를 원 미만 버림한 값이다. 고객센터 기준 (O-1042 237P에서 역산)"
---
## 요약
`earnPoints`가 배송비를 포함한 결제 금액을 반올림해 적립이 많게 나왔다. 상품 금액에서 쿠폰과 사용 포인트를 뺀 값의 1%를 버림하도록 고쳤고 O-1042가 237P로 나온다. `npm test` 24건 통과.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, 테스트: `test/earn.test.js`
- 확인: `node src/cli.js examples/O-1042.json` → 적립 예정 237P
- 선물하기 `giftPoints`는 그대로(G-0213 249P). 저장된 `order.points.earned`는 재계산하지 않는다.
