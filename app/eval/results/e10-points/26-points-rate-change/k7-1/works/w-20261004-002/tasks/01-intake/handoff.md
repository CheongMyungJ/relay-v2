---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수는 팀 지식의 규칙(환불 전후 적립 차이, 적립 초과 금지)을 제약으로 따른다"
    why: "팀 지식 refund-recovery-follows-earn-rule이 이번 요청(R-0311, 132P)을 그대로 덮음"
    by: ai
assumptions:
  - "정산팀 기준은 팀 지식의 규칙과 같다(예시 132P가 일치)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 3건은 기준 브랜치에 아직 없고 앞 Work(w-20261004-001)에서 왔다. 그 Work가 고친 earnOn/earnPoints는 이 브랜치에 없을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트가 정산팀 계산과 1~2P 어긋나는 버그의 의도 초안을 썼다. 목표는 R-0311 회수 132P, 환불 금액·영수증·저장된 적립값 불변이다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` createRefund 마지막 return의 `pointsRecovered`가 `percentOf(refundGoods, POINT_RATE_PERCENT)`로 환불 상품 금액에 바로 적립률을 곱한다(원인 확정 아님, 참고용 가설).
- 테스트: `npm test`(node --test), `test/refund.test.js`.
- 참고 팀 지식: docs/knowledge/refund-recovery-follows-earn-rule.md, points-earn-excludes-shipping-floor.md, points-earn-saved-orders-not-recomputed.md (모두 기준 브랜치에 아직 없음).
