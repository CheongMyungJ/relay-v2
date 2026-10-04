---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수의 새 비율 적용은 이번 범위에서 뺀다 (비목표)"
    why: "정산팀과 따로 정할 일이라고 사람이 말함"
    by: human
  - what: "업무 유형 bugfix를 그대로 두고 진행한다"
    why: "요청은 정책 변경이라 유형과 어긋나 보여 물었고, 사람이 그대로 진행하기로 함"
    by: human
assumptions:
  - "신규 주문만 2%를 적용하고 저장된 주문은 다시 계산하지 않는다 (요청 문장 그대로)"
  - "선물하기 적립은 같은 적립률 상수를 쓰므로 2%를 따른다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "`src/orders/refund.js:34`도 POINT_RATE_PERCENT를 쓴다. 상수만 2로 바꾸면 환불 회수가 함께 바뀌므로, 환불 계산은 변경 전 결과를 유지해야 한다"
  - "이 브랜치의 코드는 아직 옛 기준(배송비 포함 결제 금액, 반올림)이다. 적립률만 2%로 바꾸면 O-1107은 547P가 되어 486P와 어긋난다. 앞 Work(w-20261004-001, -002)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "아직 규칙을 따르지 않음: src/orders/refund.js — 부분 환불 회수에 새 적립률(2%)을 쓸지는 정산팀과 따로 정할 예정, 사람이 이번 범위에서 뺌 (사람)"
  - "적립률은 2026-10-04 배포부터 1%에서 2%로 올렸다. 이미 저장된 주문의 적립은 다시 계산하지 않고, 영수증 글자(src/format/)는 바뀌면 안 된다 (사람)"
---
## 요약
기본 적립률을 1%에서 2%로 올리는 일의 의도 초안을 썼다. 신규 주문만 적용하고, 저장된 적립 값과 영수증 글자는 그대로 둔다. 예시 O-1107은 486P가 되어야 한다.
## 다음 task가 알아야 할 것
- 적립률 상수는 `src/config.js:9` `POINT_RATE_PERCENT`. 쓰는 곳: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`(환불은 이번 범위 밖).
- 현재 `earnPoints`는 `order.amounts.total`(배송비 포함)을 `percentOf`(반올림, `src/money.js`)로 계산한다. O-1107은 배송비 3,000원이 붙어 2%면 547P다. 486P는 팀 지식의 기준(배송비 제외, 버림)에서만 나온다.
- 참고할 팀 지식: `docs/knowledge/points/earn-points-basis.md`, `docs/knowledge/points/partial-refund-recovery-not-proportional.md` (둘 다 기준 브랜치에는 아직 없음).
- 내 가설(참고용): 적립률만 바꾸면 안 되고 적립 기준 변경이 함께 있어야 486P가 나온다.
