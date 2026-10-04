---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 배송비를 뺀 결제 금액(포인트 사용 반영)이고 원 단위 버림으로 한다"
    why: "O-1042 기대값 237P와 맞는 계산은 23,770원 × 1% = 237.7의 버림뿐이다. 반올림은 238P"
    by: ai
  - what: "공용 percentOf를 바꾸지 않고 earnPoints 안에서 버림 계산한다"
    why: "percentOf는 선물하기 적립도 쓰고 gift-points.js는 수정 금지"
    by: ai
assumptions:
  - "적립 안내의 소수점 처리는 버림이라고 보았다. O-1042 한 건으로만 확인했다"
rejected:
  - "배송비만 제외: 반올림 때문에 238P가 나와 기대값과 다름"
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(src/gift/gift-points.js)은 여전히 배송비 포함 반올림이다. 범위에서 제외돼 그대로 둠"
  - "버림 규칙은 O-1042 한 건 기준이다. 적립 안내 원문으로 확인하지 못함"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립은 배송비를 뺀 결제 금액의 1%를 원 단위 버림으로 계산한다(src/points/earn.js). 선물하기 적립은 아직 이 규칙을 따르지 않음: src/gift/gift-points.js — 배송비 포함 반올림, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
`earnPoints`가 배송비 포함 금액을 반올림해 적립이 많게 나오던 것을 고쳤다. 이제 배송비를 뺀 결제 금액을 버림으로 계산하고 O-1042는 237P다. 재현 테스트를 추가했고 `npm test`는 21개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, 테스트: `test/order.test.js` 마지막 테스트.
- 재현: `node src/cli.js examples/O-1042.json` → 237P. O-1077은 423P(변화 없음), O-1107은 243P.
- `src/format/`, `src/gift/gift-points.js`는 수정하지 않았다. 저장된 `points.earned`를 읽는 코드도 그대로다.
