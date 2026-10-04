---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "유형은 bugfix 그대로 진행한다"
    why: "정책 변경이지만 고객센터 기대값(486P)과 코드 결과가 달라 함께 맞춰야 함. 사람이 선택"
    by: human
  - what: "O-1107 기대 적립은 486P (배송비 제외 기준액 24,330원의 2%, 원 단위 버림)"
    why: "사람이 486P를 선택. 팀 지식 earn-rule.md의 규칙과 같음"
    by: human
assumptions:
  - "선물하기와 부분 환불 회수도 일반 주문과 같은 2% 규칙을 쓴다 (팀 지식 규칙)"
rejected:
  - "547P(현재 계산식에 비율만 변경): 고객센터 기대값과 다르고 팀 지식 규칙과 어긋남"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 기준액 계산(배송비 제외, 버림)이 이 브랜치에는 아직 없음. 머지 순서에 따라 충돌 가능"
  - "이미 적립된 값은 다시 계산하지 않아야 하므로 저장된 값을 쓰는 경로(전체 취소, 영수증)를 건드리지 않게 주의"
recommended_next: null
knowledge_candidates:
  - "적립률은 기본 1%에서 2%로 올리기로 했다. 2026-10 배포부터 적용 (사람)"
---
## 요약
적립률을 2%로 올리고 O-1107이 486P가 되게 하는 intent 초안을 썼다. 저장된 적립값과 영수증 글자는 그대로 둔다.
## 다음 task가 알아야 할 것
- `src/config.js:9` `POINT_RATE_PERCENT = 1`. 사용처: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`.
- `src/money.js` `percentOf`는 반올림이다. 현재 적립은 `order.amounts.total`(배송비 포함) 기준이다.
- O-1107: 상품 27,350, 쿠폰 2,000, 배송비 3,000, 사용 포인트 1,020, total 27,330. 비율만 올리면 547P, 기준액(24,330) 버림이면 486P.
- 참고: 팀 지식 `docs/knowledge/points/earn-rule.md` (기준 브랜치에는 아직 없음).
- 테스트: `npm test` (node --test).
