---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트 기준은 팀 지식의 부분 환불 회수 규칙으로 한다"
    why: "O-1077: 환불 전 적립 403P(40,310원), 환불 후 남은 27,180원 → 271P, 차이 132P로 정산팀 값과 일치"
    by: ai
assumptions:
  - "선물하기 적립과 전체 취소는 요청에 없어 이번 범위에서 뺐다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이 브랜치의 `src/points/earn.js:6`은 아직 결제 금액(total) 기준이다. 팀 지식의 적립 규칙(상품 금액-쿠폰-사용 포인트)은 앞 Work(w-20261004-001)에서 고쳤을 수 있고 머지 대기 중이다."
  - "`src/gift/gift-points.js:6`도 total 기준이다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트가 정산팀 계산과 1~2P씩 다른 버그의 의도 초안을 썼다. 환불 금액, 영수증, 이미 적립·처리된 내역은 바꾸지 않는다.
## 다음 task가 알아야 할 것
- 참고 지식: `docs/knowledge/points/earn-rule.md` (기준 브랜치에는 아직 없음)
- `src/orders/refund.js:34`: `pointsRecovered`를 `percentOf(refundGoods, POINT_RATE_PERCENT)`로 계산 (환불 상품 금액 기준)
- O-1077/R-0311: 현재 131P, 정산팀 132P. 환불 전 남은 적립(403P)에서 환불 후 남은 주문의 적립(27,180원 → 271P)을 뺀 값이 132P
- 테스트 명령: `npm test` (`test/refund.test.js`)
