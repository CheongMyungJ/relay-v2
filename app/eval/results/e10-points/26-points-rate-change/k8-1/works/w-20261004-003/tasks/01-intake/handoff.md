---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "업무 유형을 bugfix 그대로 둔다"
    why: "요청이 규정 변경에 가까워 유형 불일치를 물었고, 사람이 그대로 진행하라고 답함"
    by: human
assumptions:
  - "팀 지식의 적립 규정(기준 금액=상품−쿠폰−포인트, 배송비 제외, 1P 미만 버림)은 비율만 2%로 바뀌고 그대로 유효하다"
  - "O-1107의 486P는 이 규정으로 계산한 값이다 (24,330원 × 2% = 486.6 → 486)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이 브랜치의 `src/points/earn.js`는 아직 옛 방식(결제 금액 total의 비율, 반올림)이다. 적립 규정 지식은 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 환불 회수(`src/orders/refund.js`)도 같다."
  - "환불 회수가 earnPoints를 공유하면 비율만 바꿔도 회수가 같이 바뀐다. 환불 회수는 이번 범위 밖(정산팀과 따로 정함)이므로 현행 유지하도록 분리 필요"
recommended_next: null
knowledge_candidates:
  - "이번 Work에서 환불 회수 포인트의 새 비율 적용은 범위 밖이며 정산팀과 따로 정한다 (사람)"
  - "고칠 지식: docs/knowledge/points/earn-rule.md — 기본 적립률이 1%에서 2%로 바뀜. 기준 금액과 1P 미만 버림은 그대로 (사람)"
---
## 요약
기본 적립률 1%→2% 변경을 bugfix 유형으로 intent에 정리했다. 기존 적립분 재계산 금지와 영수증 글자(`src/format/`) 불변, 환불 회수 계산 현행 유지(정산팀과 따로 정함)를 비목표로 두었고, O-1107 = 486P를 완료조건에 넣었다.
## 다음 task가 알아야 할 것
- `src/config.js`의 `POINT_RATE_PERCENT`와 `src/points/earn.js`의 `earnPoints`(현재 `order.amounts.total` 기준 `percentOf`)가 적립 계산이다. 값만 2로 바꾸면 배송비 포함·반올림이라 O-1107이 487P가 될 수 있다(참고용 가설, 미확인).
- 참고 지식: docs/knowledge/points/earn-rule.md, docs/knowledge/points/partial-refund-recovery.md, docs/knowledge/orders/already-refunded-format.md (모두 기준 브랜치에 아직 없음)
- 선물하기(`src/gift/gift-points.js`)는 적립 경로라 2%를 따라야 한다. 환불(`src/orders/refund.js`)이 `earnPoints`를 공유하는지 확인하고, 공유하면 회수는 현행 비율로 유지해야 한다.
