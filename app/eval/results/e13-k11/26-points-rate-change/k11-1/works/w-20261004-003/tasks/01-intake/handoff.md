---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "업무 유형은 사람이 고른 bugfix 그대로 진행한다"
    why: "요청이 정책 값 변경이라 유형이 어긋나 보여 물었고, 사람이 그대로 진행을 골랐다"
    by: human
assumptions:
  - "고객센터 예시 486P는 배송비를 뺀 기준 금액 24,330원 × 2% 버림 값이라고 보았다"
  - "적립률 변경은 새 주문에만 적용하고 저장된 주문은 건드리지 않는다고 보았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "현재 브랜치의 earnPoints는 결제 금액(배송비 포함, 사용 포인트 차감)에 적립률을 곱한다. 팀 지식 규칙(배송비 제외)을 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "부분 환불 회수(src/orders/refund.js) 계산도 앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기"
  - "기존 테스트 일부(예: test/receipt.test.js의 290P)는 1% 기대값일 수 있어 2% 기준 조정 범위를 fix에서 판단해야 함"
recommended_next: null
knowledge_candidates: []
---
## 요약
기본 적립률 1%→2% 변경 요청을 intent 초안으로 정리했다. 기존 저장 값과 영수증 글자는 바꾸지 않는다.
## 다음 task가 알아야 할 것
- 적립률 상수: `src/config.js:9` `POINT_RATE_PERCENT`. 사용처: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`.
- 현재 `earnPoints`는 `order.amounts.total` 기준이다. O-1107에서 total은 27,330원이라 2%면 546P이고, 기준 24,330원이면 486P다. 이 차이는 가설이 아니라 계산 결과이니 fix에서 확인.
- 참고 팀 지식: `docs/knowledge/points/earn-points-rule.md`, `docs/knowledge/points/refund-points-recovery.md`(둘 다 기준 브랜치에는 아직 없음).
- 테스트: `npm test`(`node --test`).
