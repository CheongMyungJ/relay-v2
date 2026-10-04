---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "업무 유형은 사람이 고른 bugfix 그대로 진행"
    why: "유형이 요청과 안 맞아 보여 물었고, 사람이 '버그 수정 그대로 진행'을 골랐다"
    by: human
  - what: "선물하기 적립은 이번에 바꾸지 않고 지금 결과(1%) 그대로 둔다"
    why: "사람이 '선물하기는 제가 들은 게 없다. 요청은 기본 적립률뿐'이라고 답했다"
    by: human
  - what: "환불 회수 포인트는 지금 동작 그대로 둔다"
    why: "사람이 '새 비율 적용 여부는 이번 범위가 아니고 정산팀과 따로 정한다'고 했다"
    by: human
  - what: "적립 규정은 비율만 바뀐다(상품 금액 - 쿠폰 - 사용 포인트, 배송비 제외, 1P 미만 내림)"
    why: "사람이 규정을 직접 확인해 줬다. O-1107은 24,330원 × 2% = 486.6 → 486P로 486P와 맞는다"
    by: human
assumptions: []
rejected: []
open_questions:
  - "선물하기(`src/gift/`) 적립을 2%로 올릴지: 사람이 모른다고 함, 사람이 따로 정한다"
intent_deviation: null
risks:
  - "이 브랜치의 `src/points/earn.js`에는 적립 규정(배송비 제외, 내림)이 아직 없다(앞 Work w-20261004-001/002에서 고쳤을 수 있음, 머지 대기). 상수만 2로 바꾸면 O-1107이 486이 아니라 약 547P가 된다. 머지 시 충돌 가능"
  - "환불 회수(`refund.js:34`)와 선물하기(`gift-points.js:6`)는 `POINT_RATE_PERCENT`를 같이 쓰므로 상수만 바꾸면 2%가 된다. 1%를 유지하려면 분리가 필요하다"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 환불 회수에 새 적립률을 적용할지 — 사람이 \"이번 범위가 아니고 정산팀과 따로 정한다\"고 함, 정산팀과 사람이 정함, 지금 코드는 환불 상품 금액의 1% 반올림 (사람)"
  - "정하지 않음: 선물하기 적립률 — 사람이 \"선물하기는 제가 들은 게 없다\"고 함, 사람이 따로 정함, 지금 코드는 `POINT_RATE_PERCENT`를 같이 씀 (사람)"
  - "2026-10 적립률을 1%에서 2%로 올림. 적립 규정은 비율만 바뀐다 (사람)"
---
## 요약
적립률 1%→2% intent를 고쳤다. 환불 회수는 비목표로 옮겨 지금 동작 그대로 두고, 적립 규정을 사람이 확인한 대로 적었다. O-1107은 24,330 × 2% = 486.6 → 내림 486P로 맞다.
## 다음 task가 알아야 할 것
- `src/config.js:9` `POINT_RATE_PERCENT = 1`. 쓰는 곳: `src/points/earn.js:6`, `src/orders/refund.js:34`, `src/gift/gift-points.js:6`
- 환불 회수와 선물하기는 1%로 남겨야 하므로 상수를 나누거나 값을 고정해야 한다
- 현재 코드의 O-1107: 총액 27,330(배송비 3,000 포함) → 2%면 547P(반올림). 규정은 배송비 제외, 내림
- `src/money.js` `percentOf`는 반올림이다. 적립은 내림이어야 한다
- 참고: `docs/knowledge/points/earn-rule.md` (기준 브랜치에는 아직 없음)
- 테스트: `npm test`
