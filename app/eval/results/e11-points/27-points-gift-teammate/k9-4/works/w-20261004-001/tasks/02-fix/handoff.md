---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 배송비를 뺀 결제 금액으로 하고 원 단위 미만은 버린다"
    why: "O-1042에서 237P를 내는 규칙은 이것뿐이다. 반올림이면 238P가 된다"
    by: ai
  - what: "공용 percentOf를 바꾸지 않고 earn.js에서 직접 버림 계산한다"
    why: "percentOf는 선물하기 적립 등이 쓴다. 비목표를 지키기 위해"
    by: ai
assumptions:
  - "고객센터 규칙(배송비 제외, 버림)은 O-1042의 237P 하나로 추정했다. 다른 주문의 기대값은 확인하지 못했다"
rejected:
  - "total 그대로 반올림: 268P라 맞지 않음"
  - "goods − coupon 기준: 252P라 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "고객센터 규칙을 O-1042 한 건으로만 추정했다. 배송비 없는 주문의 버림/반올림 차이는 확인하지 않음"
  - "선물하기 적립(giftPoints)은 비목표라 그대로 두었다. 같은 버그가 남아 일반 주문과 값이 달라진다"
  - "임시로 만든 /earn.new 파일이 남아 있다. 삭제가 안전 검사에 막혀 사람이 지워야 한다. 레포 밖이다"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립 포인트는 배송비를 뺀 결제 금액의 1%이며 원 단위 미만은 버린다 (고객센터 기준, 요청에서 확인)"
  - "아직 규칙을 따르지 않음: src/gift/gift-points.js — 배송비 포함, 반올림 계산 그대로, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
`earnPoints`가 배송비를 포함해 반올림하던 것을 배송비 제외, 버림으로 고쳤다. O-1042는 268P에서 237P가 된다. 테스트를 추가했고 `npm test` 21개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`. 테스트: `test/order.test.js` 마지막 항목.
- `src/format/`, `src/gift/`는 바뀌지 않았다. 저장된 `points.earned`를 읽는 코드도 그대로다.
- 확인: `node src/cli.js examples/O-1042.json | grep 적립`
- 레포 밖 `/earn.new` 임시 파일은 사람이 지워야 한다.
