---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "이전 환불이 있으면 이번 회수 = (원 적립 − 전체 재계산 적립) − 이전 환불까지의 회수분(원 적립 − 이번 환불 전 재계산 적립)"
    why: "intent가 여러 번 환불 합산을 명시하지 않음. 그대로 쓰면 이전 환불 회수분을 중복 회수함. 이전 환불 내역은 다시 계산하지 않는 비목표와 intake 가정에 맞춤"
    by: ai
assumptions:
  - "이전 환불의 실제 회수분은 입력에 없어, 이전 환불 시점에도 같은 규칙이 적용됐다고 보고 재계산함"
rejected:
  - "올림: 13,130원 1% 올림은 132지만 정산팀 규칙이 아니라고 사람이 답함"
open_questions: []
intent_deviation: null
risks:
  - "저장된 earned가 옛 규칙(반올림, 배송비 포함)으로 계산됐으면 재계산 적립과 어긋나 회수가 1~2P 차이날 수 있음"
  - "src/points/earn.js의 earnPoints는 아직 옛 규칙. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "alreadyRefunded 경로는 위 가정에 의존하며 단위 테스트 1건뿐"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/partial-refund-recovery-not-proportional.md — 회수는 원래 적립 − 남은 상품 재계산 적립(버림, 쿠폰·사용 포인트 유지, 배송비 제외)으로 정해졌다 (사람)"
---
## 요약
부분 환불 회수 포인트를 정산팀 규칙으로 고쳤다. O-1077/R-0311은 131P에서 132P가 되었고 환불 금액 13,130원은 그대로다. `npm test` 22개 통과.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` `createRefund`: `earnedFor`로 재계산, `recoveredBefore`로 이전 환불분 차감
- `src/money.js`: `percentFloor` 추가
- 테스트: `test/refund.test.js` 신규 2건 (수정 전 실패 확인)
- 기존 테스트 변경 없음
