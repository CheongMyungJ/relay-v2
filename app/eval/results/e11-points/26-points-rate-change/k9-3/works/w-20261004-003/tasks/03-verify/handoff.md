---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)을 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "환불 회수는 1%와 반올림 방식이라 앞 Work(w-20261004-002)의 회수 규칙과 다르다. 사람이 이번 범위에서 뺌"
  - "앞 Work(w-20261004-001, -002)에서 earnFromAmounts를 고쳤을 수 있음, 머지 대기. 시그니처가 다르면 머지 때 충돌한다"
  - "쿠폰 + 사용 포인트가 상품 금액을 넘으면 적립이 음수가 될 수 있는지 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이고 사람이 반영하지 않기로 했다. 완료조건 7개 모두 통과했고 `npm test`는 24개 통과, O-1107은 486P다. 테스트 파일 변경 3건은 모두 약화 아님으로 판정했다. `pr.md`를 썼다.
고친 지식: docs/knowledge/points/earn-base.md — 앞 Work 내용을 살려 적립률 1% → 2% 이력과 예시를 더하고 환불 회수를 다른 항목 참고로 바꿨다
고친 지식: docs/knowledge/points/stored-earned-not-recalculated.md — 적립률 변경에도 재계산하지 않음, 환불 회수율 1% 유지를 더하고 src/orders/refund.js를 '아직 규칙을 따르지 않는 곳'에 적었다
## 다음 task가 알아야 할 것
- 판정 근거: `verification.md`, PR 초안: `pr.md`
- 코드 커밋 4a75265, 지식 커밋 41cfd8f
- `src/config.js`: `POINT_RATE_PERCENT = 2`, `REFUND_RECOVER_RATE_PERCENT = 1`
- `src/orders/refund.js:34`: 환불 회수는 1% 반올림
