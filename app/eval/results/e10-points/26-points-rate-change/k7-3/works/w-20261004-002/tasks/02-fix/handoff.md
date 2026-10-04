---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "나눠 환불할 때는 이전 부분 환불에서 이미 회수한 몫(저장 적립 - 이전 시점 재계산 적립)을 뺀다"
    why: "intent 식을 그대로 쓰면 두 번째 환불부터 누적분을 다시 회수한다. 첫 환불은 intent 식과 같다"
    by: ai
  - what: "팀 지식 refund-recovery-vs-earn-basis.md의 '환불 상품 금액 × 1%' 식 대신 사람이 알려 준 정산팀 식을 따른다"
    why: "intent 제약이 사람이 이번에 알려 준 식을 따르라고 함 (docs/knowledge/refund-recovery-vs-earn-basis.md)"
    by: ai
assumptions:
  - "이전 환불이 있었는지는 alreadyRefunded로 만든 refundedBefore > 0 으로 판단한다. 이전 환불이 같은 식으로 회수됐다고 가정한다"
rejected:
  - "환불 상품 금액 × 1% 올림: 사람이 아니라고 답함"
  - "환불 상품 금액 × 1% 버림(팀 지식 식): O-1077에서 131이라 정산팀 값 132와 다름"
open_questions: []
intent_deviation: null
risks:
  - "이미 처리한 환불이 옛 식(반올림)으로 회수됐으면, 이후 환불의 이전 회수분을 새 식으로 가정해 1P 차이가 날 수 있음"
  - "팀 지식 refund-recovery-vs-earn-basis.md는 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 시 같은 파일(refund.js)에서 충돌 가능"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 = 저장된 적립 - (남은 상품 금액 - 쿠폰 - 사용 포인트)의 1% 버림. 나눠 환불하면 이전 회수분을 뺀다. 예: O-1077/R-0311은 403 - 271 = 132P (사람)"
---
## 요약
`createRefund`의 회수 포인트를 정산팀 기준(저장 적립 - 남은 상품 기준 재계산 적립, 버림)으로 고쳤다. O-1077/R-0311은 131에서 132가 됐다. 재현 테스트를 추가했고 `npm test` 22개가 통과한다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` `createRefund`: 회수 계산 / `src/money.js` `floorPercentOf` 추가
- 테스트 `test/refund.test.js` 하단 2개. 명령 `npm test`
- 기준 커밋에서 실패하는 기존 테스트는 없음
- `refundAmount`, `cancelOrder`, 영수증은 변경 없음
