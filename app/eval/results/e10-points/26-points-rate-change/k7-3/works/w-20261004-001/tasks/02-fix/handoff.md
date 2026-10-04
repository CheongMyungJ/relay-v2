---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 '배송비를 뺀 결제 금액의 1%, 원 단위 미만 버림'으로 한다"
    why: "기대값 237P(O-1042)를 만드는 유일하게 자연스러운 기준. 반올림이면 238P, 배송비 포함이면 268P"
    by: ai
  - what: "percentOf는 그대로 두고 earn.js에서 직접 버림 계산한다"
    why: "percentOf는 환불 회수(refund.js)가 쓰고 있어 범위 밖(비목표)"
    by: ai
assumptions:
  - "고객센터 적립 안내 기준 문서가 레포에 없어, 기대값 237P 하나로 배송비 제외와 버림 규칙을 추론함"
  - "배송비 제외 + 버림이 모든 주문에 통하는지는 다른 고객센터 계산값으로 확인하지 못함"
rejected:
  - "쿠폰 전 금액 기준: 252P가 되어 237P와 안 맞음"
  - "배송비 제외 + 반올림 유지: 238P가 되어 237P와 안 맞음"
open_questions: []
intent_deviation: null
risks:
  - "src/gift/gift-points.js는 같은 식을 그대로 써서 선물하기 적립은 여전히 배송비 포함 + 반올림이다(범위 밖)"
  - "환불 포인트 회수(refund.js)는 percentOf 반올림이라 새 적립 규칙과 1P 어긋날 수 있다(범위 밖)"
  - "규칙이 추론이므로 고객센터 담당에게 다른 주문 값으로 확인하면 좋다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트 기준은 배송비를 뺀 결제 금액의 1%, 원 단위 미만 버림이다(고객센터 적립 안내 O-1042 237P에서 추론, 문서 없음). 선물하기·환불 회수는 아직 옛 식."
---
## 요약
O-1042의 적립이 268P로 나온 것은 배송비가 포함된 결제 금액에 반올림을 적용했기 때문이다. 배송비를 빼고 버림하도록 `earnPoints`를 고쳐 237P가 나온다. 재현 테스트를 추가했고 `npm test`는 25개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js:5-6` (`total - shipping`, `Math.floor`)
- 테스트: `test/earn.test.js` (수정 전 4개 실패, 후 통과)
- 확인: `node src/cli.js examples/O-1042.json` → 237P
- 영수증 코드(`src/format/`)와 저장된 `points.earned`는 건드리지 않음
- 선물하기(`src/gift/gift-points.js:6`)와 환불(`src/orders/refund.js`)은 범위 밖이라 그대로
