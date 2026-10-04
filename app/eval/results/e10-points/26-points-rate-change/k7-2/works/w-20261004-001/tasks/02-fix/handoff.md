---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "`percentOf`는 건드리지 않고 `earn.js`에서만 버림 계산을 한다"
    why: "`percentOf`는 선물하기와 환불 회수도 쓰며, 둘 다 이번 비목표"
    by: ai
assumptions: []
rejected:
  - "percentOf를 버림으로 변경: 선물하기·환불 회수까지 바뀌어 비목표를 어김"
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(src/gift/gift-points.js)은 결제 금액 기준·반올림 그대로이며 규정 미확인"
  - "환불 회수(src/orders/refund.js:34)는 percentOf(환불 상품 금액)로 계산해 새 적립 규정과 어긋날 수 있음(범위 밖)"
recommended_next: null
knowledge_candidates: []
---
## 요약
적립이 배송비 포함 결제 금액을 반올림해 268P가 나오던 것을 (상품−쿠폰−사용 포인트)의 1% 버림으로 고쳐 O-1042가 237P가 된다. 재현 테스트 4개를 추가했고 `npm test` 24개가 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`. 테스트: `test/earn.test.js`.
- `src/format/`과 `money.js`는 바뀌지 않았다.
- 확인: `node src/cli.js examples/O-1042.json` → 적립 예정 237P.
