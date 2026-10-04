---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 배송비 제외 금액, 반올림을 버림으로 정했다"
    why: "237P가 나오는 기준이 이것뿐이다 (배송비 제외만이면 238, 버림만이면 267)"
    by: ai
  - what: "`percentOf`는 고치지 않고 `earn.js`에서만 계산한다"
    why: "gift-points.js와 refund.js가 공유하고, 선물하기 적립은 비목표다"
    by: ai
assumptions:
  - "고객센터 규칙은 요청에 적혀 있지 않아 237P에서 거꾸로 추정했다 (배송비 제외, 원 단위 버림)"
rejected:
  - "percentOf 수정: gift와 refund도 쓰므로 비목표에 닿는다"
open_questions: []
intent_deviation: null
risks:
  - "환불 포인트 회수(`src/orders/refund.js:34`)는 여전히 반올림이라 새 적립(버림)과 1P 어긋날 수 있다. 범위 밖이라 건드리지 않았다"
  - "선물하기 적립은 그대로라 배송비 포함·반올림 기준이 남아 있다 (비목표)"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립은 배송비를 뺀 결제 금액에 적립률을 곱하고 원 단위로 버린다 (고객센터 기준, O-1042 = 237P)"
---
## 요약
적립 계산이 배송비를 포함하고 반올림해 O-1042가 268P로 나왔다. `earnPoints`를 배송비 제외, 버림으로 바꿔 237P가 나온다. `npm test` 22개 통과.
## 다음 task가 알아야 할 것
- 수정 위치: `src/points/earn.js:6`. 테스트는 `test/earn.test.js`.
- `src/format/`과 `src/gift/gift-points.js`는 바뀌지 않았다.
- 저장된 `points.earned`를 다시 계산하는 경로는 만들지 않았다.
- 환불 회수의 반올림(`refund.js:34`)과의 불일치는 확인이 필요하다.
