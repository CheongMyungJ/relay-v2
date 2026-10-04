---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "완료조건에 O-1077/R-0311의 회수 포인트 132P를 넣는다"
    why: "요청에 정산팀 계산값 132P가 명시돼 있음"
    by: ai
assumptions:
  - "정산팀 계산은 팀 지식의 회수 방식(환불 전 남은 주문 적립액 − 환불 후 남은 주문 적립액)과 같다고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 이 브랜치의 `src/points/earn.js`는 아직 옛 방식(결제 금액 1% 반올림)이고 `earnBase`/`earnOn`이 없다. 회수가 적립 규정과 맞아야 해서 fix가 이 코드에 의존할 수 있다."
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트가 정산팀 계산과 1~2P 어긋나는 버그의 의도 초안을 썼다. 기본 완료조건에 O-1077/R-0311의 132P, 다회 환불 합계 상한, 환불 금액·영수증 불변을 더했다.
## 다음 task가 알아야 할 것
- 회수 계산 위치: `src/orders/refund.js`의 `createRefund`. `pointsRecovered`가 `percentOf(refundGoods, POINT_RATE_PERCENT)`다. 환불 상품 금액만 1% 반올림한다. 쿠폰·사용 포인트는 반영하지 않는다.
- 예시 숫자: O-1077은 상품 47,310, 쿠폰 5,000, 포인트 2,000, 적립 403. R-0311은 SP-0656 2개로 13,130원이다. 현재 회수는 131P다. 남은 주문(27,180)의 적립을 뺀 방식이면 403−271=132P다. (참고용 가설, 원인 확정 아님)
- 참고할 팀 지식: docs/knowledge/points/earn-rule.md, docs/knowledge/points/partial-refund-recovery.md (둘 다 기준 브랜치에 아직 없음)
- 테스트: `npm test` (`node --test`). 환불 테스트는 `test/refund.test.js`.
