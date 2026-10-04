---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "earnBase를 새로 만들지 않고 refund.js 안에 남은 주문 적립 계산을 둔다"
    why: "이 브랜치에는 earnBase가 없다(앞 Work w-20261004-001에서 추가, 머지 대기). 팀 지식 docs/knowledge/points/earn-rule.md의 회수 규칙과 버림 규칙은 따랐다"
    by: ai
  - what: "이전 환불이 있는 주문은 환불 전 적립을 남은 금액으로 계산한다"
    why: "저장된 points.earned는 최초 주문 기준이라 이전 환불분이 이미 회수됐다. 첫 환불만 저장값을 쓴다"
    by: ai
assumptions:
  - "정산팀 계산은 팀 지식 규칙(환불 전 적립 − 환불 후 적립, 버림)과 같다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 earn.js/refund.js를 고쳤을 수 있음, 머지 대기. 머지 때 refund.js 충돌 가능, 그때 earnBase로 바꿔 쓰면 된다"
  - "기준 브랜치의 저장된 earned는 결제 금액(배송비 포함) 반올림 기준이라, 배송비가 있는 옛 주문은 첫 환불에서 규칙과 1P 차이가 날 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트를 환불 상품 금액의 반올림 대신 (저장된 적립 − 환불 후 적립, 버림)으로 계산하게 고쳤다. O-1077/R-0311은 132P, 환불 금액 13130 그대로다. 테스트 추가, `npm test` 21개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/orders/refund.js`의 `remainingEarn`, `pointsRecoveredOf`
- 새 테스트: `test/refund.test.js` 마지막 (수정 전 실패 확인)
- `cancelOrder`, `src/format/`은 손대지 않음
- 앞 Work 머지 후 `earnBase` 사용으로 정리 가능
