---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 회수(`createRefund`) 동작은 이번에 바꾸지 않는다"
    why: "새 비율 적용 여부는 정산팀과 따로 정하기로 함. 사람이 이번 범위에서 뺌"
    by: human
  - what: "업무 유형 bugfix를 그대로 두고 진행"
    why: "요청은 적립률 변경이라 유형이 어긋나 보여 물었고, 사람이 bugfix 유지를 골랐다"
    by: human
assumptions:
  - "O-1107의 486P는 팀 지식 earn-base 규칙(배송비 제외, 버림)으로 계산한 값이다: 24,330 × 2% = 486.6 → 486"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "earn-base, stored-earned 규칙은 앞 Work(w-20261004-001, -002)에서 왔고 기준 브랜치에 아직 없다. 이 브랜치 코드는 배송비 포함 결제 금액 기준일 수 있어, 앞 Work 머지 전이면 O-1107이 486P가 되지 않을 수 있음(앞 Work에서 고쳤을 수 있음, 머지 대기)"
recommended_next: null
knowledge_candidates:
  - "아직 규칙을 따르지 않음: src/orders/refund.js — 환불 회수가 적립률 변경(2%)을 따르지 않고 기존 동작 유지, 정산팀과 따로 정하기로 해 사람이 이번 범위에서 뺌 (사람)"
  - "2026-10-04 기본 적립률을 1%에서 2%로 올림, 이번 배포부터 적용, 이미 적립된 포인트는 재계산하지 않음 (사람)"
---
## 요약
적립률 1%→2% 변경 intent 초안을 썼다. 예시 O-1107은 486P, 저장된 points.earned와 영수증(src/format/)은 건드리지 않는다.
## 다음 task가 알아야 할 것
- 비율 상수: `src/config.js:9` `POINT_RATE_PERCENT = 1`. 사용처: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`.
- `POINT_RATE_PERCENT`는 refund.js도 쓰므로 상수만 바꾸면 환불 회수가 바뀐다. 환불 회수는 변경 전 값 그대로 유지해야 한다.
- 위 세 곳은 지금 `order.amounts.total`이나 `refundGoods`에 비율을 곱한다. 팀 지식 기준(`earnFromAmounts`)과 다를 수 있으니 fix에서 확인할 것(가설, 확인 안 됨).
- 참고 지식: `docs/knowledge/points/earn-base.md`, `docs/knowledge/points/stored-earned-not-recalculated.md`
- 테스트: `npm test` (node --test)
