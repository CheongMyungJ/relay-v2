---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "업무 유형을 버그 수정(bugfix) 그대로 두고 intent를 쓴다"
    why: "요청은 새 정책(적립률 변경)이라 유형과 어긋나 보여 물었고, 사람이 그대로 진행하기로 했다"
    by: human
  - what: "환불 회수 포인트 계산은 이번 범위에서 뺀다 (비목표)"
    why: "새 비율을 회수에 쓸지는 정산팀과 따로 정하기로 했다는 사람의 말"
    by: human
  - what: "적립 기준은 상품−쿠폰−사용 포인트(배송비 제외), 1P 미만 버림"
    why: "사람이 직접 확인해 줬고 팀 지식 규칙과 같으며 O-1107 기대값 486P와 맞는다"
    by: human
assumptions: []
rejected:
  - "부분 환불 회수에 2% 적용: 범위 밖이라 사람이 뺐다"
open_questions: []
intent_deviation: null
risks:
  - "`createRefund`가 `POINT_RATE_PERCENT`를 그대로 import해 회수 계산에 쓴다(`src/orders/refund.js:34`). config 값을 2로 바꾸면 환불 회수도 따라 바뀌므로 환불 쪽 비율을 분리하거나 고정해야 한다"
  - "앞 Work(w-20261004-001)에서 적립 기준을 고쳤을 수 있음, 머지 대기. 현재 `earn.js`와 `gift-points.js`는 결제 금액 반올림이다"
recommended_next: null
knowledge_candidates:
  - "적립률을 바꿔도 환불 회수 포인트 계산은 정산팀과 따로 정하기 전까지 새 비율을 적용하지 않는다 (사람)"
---
## 요약
적립률 1%→2% 적용 intent 초안이다. 환불 회수 계산은 비목표로 빼고, 적립 기준(배송비 제외, 내림)을 명시했다. 유형은 bugfix 그대로다.
## 다음 task가 알아야 할 것
- `src/config.js:9` `POINT_RATE_PERCENT = 1`. 적립 사용처: `src/points/earn.js:6`, `src/gift/gift-points.js:6`. 환불 사용처 `src/orders/refund.js:34`는 값이 같이 바뀌지 않게 주의한다.
- 현재 적립은 `percentOf`(`src/money.js:14`, 반올림)에 결제 금액을 넣는다. O-1107을 결제 금액으로 2% 계산하면 547이고, 기준을 상품−쿠폰−사용 포인트의 내림으로 하면 486이다.
- 참고 팀 지식: `docs/knowledge/point-earn-base-excludes-shipping.md` (기준 브랜치에 아직 없음).
- 테스트: `npm test`. 영수증 `src/format/receipt.js`는 건드리지 않는다.
