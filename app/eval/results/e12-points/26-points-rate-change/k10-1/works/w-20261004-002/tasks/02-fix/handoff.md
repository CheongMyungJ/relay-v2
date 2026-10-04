---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "이전 부분 환불이 있으면 이번 환불 직전 남은 상품의 재계산 적립에서 이번 남은 상품의 재계산 적립을 뺀 값을 회수한다"
    why: "저장된 적립에서 바로 빼면 이전 환불 때 회수한 몫을 다시 회수한다. 이전 환불이 없으면 intent 식 그대로"
    by: ai
assumptions:
  - "이전 환불(alreadyRefunded)이 있을 때의 계산은 사람이 정하지 않았고 위 방식으로 가정함. 사람 확인 안 됨"
  - "이전 환불은 새 식으로 회수했다고 가정함 (이미 처리한 환불은 다시 계산하지 않음)"
rejected:
  - "환불 상품 금액의 1% 버림: 사람이 정산팀 계산식이 아니라고 함 (131P)"
open_questions: []
intent_deviation: null
risks:
  - "alreadyRefunded 계산 방식은 가정이라 정산팀 확인이 필요함"
  - "earn-rule.md의 부분 환불 회수 문장(환불 상품 금액의 1% 버림)이 새 식과 달라 verify에서 고쳐야 함. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-rule.md — 부분 환불 회수 포인트는 '주문에 저장된 원래 적립 − 남은 상품으로 다시 계산한 적립'이다. 재계산은 (남은 상품 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림이고 쿠폰·사용 포인트는 남은 주문에 그대로 둔다 (사람)"
---
## 요약
부분 환불 회수 포인트를 원래 적립 − 남은 상품 재계산 적립(버림)으로 고쳤다. O-1077/R-0311은 131에서 132가 됐다. 테스트 2개를 추가했고 `npm test` 22개가 통과한다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` `createRefund`, `earnOnRemaining`: 회수 계산
- 이전 환불이 있을 때 회수 = 직전 남은 상품 재계산 적립 − 이번 남은 상품 재계산 적립 (가정, O-1077에서 SP 환불 뒤 TW 환불이면 83P)
- 테스트: `test/refund.test.js` 21, 22번. 수정 전 둘 다 실패 확인
- `refundAmount`와 `src/format/`은 건드리지 않음
