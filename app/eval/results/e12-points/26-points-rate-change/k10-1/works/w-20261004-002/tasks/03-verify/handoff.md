---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 3건(권장 1, 사소 2)을 반영하지 않음"
    why: "사람이 '반영하지 않음'을 고름. 코드 변경 없이 남은 위험으로 기록"
    by: human
assumptions:
  - "이전 부분 환불이 있을 때의 회수 계산은 AI 가정이며 사람 확인 안 됨"
rejected:
  - "환불 상품 금액의 1% 버림: 정산팀 계산식이 아님 (131P)"
open_questions: []
intent_deviation: null
risks:
  - "이전 부분 환불이 있는 주문의 회수 계산은 정산팀 확인이 필요함"
  - "earnOnRemaining과 earnBase 중복. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "저장된 적립이 재계산 적립보다 작은 옛 주문은 회수가 음수일 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건은 사람이 반영하지 않기로 했다. 완료조건 5개 모두 통과했다(재현 132, `npm test` 22 pass). pr.md를 썼다.
고친 지식: docs/knowledge/points/earn-rule.md — 부분 환불 회수를 '원래 적립 − 남은 상품 재계산 적립'으로 바꾸고, 이전 환불이 있을 때의 계산을 '아직 정하지 않은 것'에 적음
## 다음 task가 알아야 할 것
- `src/orders/refund.js` `createRefund`, `earnOnRemaining`: 회수 계산
- 테스트 `test/refund.test.js` 마지막 2개, 변경은 추가만
- 지식 파일은 앞 Work가 머지되지 않아 같은 경로에 새로 만듦
