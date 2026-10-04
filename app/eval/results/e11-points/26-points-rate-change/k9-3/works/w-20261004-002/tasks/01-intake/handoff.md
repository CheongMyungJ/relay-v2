---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "정산팀이 말한 132P가 맞는 값이라고 보고 완료조건으로 삼음"
  - "쿠폰·사용 포인트가 있는 다른 부분 환불에서도 정산팀 계산 방식이 같다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 earn-base.md의 earnFromAmounts는 기준 브랜치에 아직 없음(앞 Work w-20261004-001, 머지 대기). src/points/earn.js는 아직 earnPoints(결제 금액 기준)만 있음. 앞 Work에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트가 정산팀 계산과 1~2P 어긋나는 버그의 intent 초안을 썼다. 기준 사례는 O-1077/R-0311(131P → 132P).
## 다음 task가 알아야 할 것
- 참고용 가설(intent에는 안 씀): R-0311 환불 상품 13,130원의 1%는 131.3 → 131. 정산팀 132P는 적립 403P − 환불 후 남은 기준 금액 (47,310−13,130−5,000−2,000=27,180)의 1% 271P = 132와 일치한다. 즉 환불 금액만 따로 1% 하지 않고 적립 기준 차이로 계산했을 가능성이 있다. fix에서 확인할 것.
- `src/orders/refund.js:35` `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)`
- 테스트: `npm test` (node --test), `test/refund.test.js`
- 팀 지식 참고: docs/knowledge/points/earn-base.md, stored-earned-not-recalculated.md (둘 다 기준 브랜치에 없음)
