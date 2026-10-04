---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1, 2는 반영하지 않는다"
    why: "사람이 반영하지 않기로 함"
    by: human
  - what: "회수 = 저장된 order.points.earned(첫 환불) 또는 재계산한 환불 전 적립분(나눠 환불) − 남은 상품 기준 적립으로 바꾼다"
    why: "사람이 요청함"
    by: human
assumptions:
  - "나눠 환불의 둘째 이후는 이전 회수량 기록이 없어 환불 전 적립분을 재계산한다. 이 방식이 사람이 말한 '이미 처리한 환불을 다시 계산하지 않음'과 맞는다고 해석함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "적립식 공유 함수(earnOn)는 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 시 refund.js의 earnOnBase를 바꿔야 함"
  - "이 브랜치의 earnPoints는 아직 총액 기준·반올림이라 옛 규칙 저장 주문은 저장 적립과 회수 합이 맞지 않을 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(중복 식 권장, 테스트 사소)은 사람이 반영하지 않았다. 사람 요청으로 첫 부분 환불의 회수를 저장 적립 − 남은 상품 적립으로 바꿨다. R-0311 132P, 나눠 환불 합 132P, 환불 금액 13,130원, `npm test` 23개 통과. 모든 완료조건 통과.
고친 지식: docs/knowledge/points/partial-refund-recovery.md — 첫 환불의 환불 전 적립분은 저장된 points.earned를 쓴다는 점을 추가
## 다음 task가 알아야 할 것
- `src/orders/refund.js` createRefund: `earnedBefore`, `earnOnBase`.
- 확인: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P.
