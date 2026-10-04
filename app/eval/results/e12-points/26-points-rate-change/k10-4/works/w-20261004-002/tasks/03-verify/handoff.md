---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(두 번째 부분 환불의 중복 회수 가능성), 2(테스트 추가)를 반영하지 않음"
    why: "사람이 '반영하지 않음'을 선택. 앞선 회수분 처리는 intent에서 정해지지 않았음"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 주문의 두 번째 이후 부분 환불에서 앞선 회수분을 차감하지 않아 중복 회수 가능성이 있다"
  - "alreadyRefunded가 있는 경우를 고정하는 테스트가 없다"
  - "src/points/earn.js는 결제 금액을 반올림해 적립 규정과 다르다. 비목표라 고치지 않음"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(권장 1, 사소 1)을 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과, `npm test` 21개 통과, 재현 명령 132P. 테스트 파일은 추가만 있어 약화 아님.
고친 지식: docs/knowledge/points/earn-rule.md — 부분 환불 회수 규정을 `## 규칙`으로 옮기고, 두 번째 부분 환불의 앞선 회수분 차감은 `## 아직 정하지 않은 것`에 적음 (기준 브랜치에 없던 파일이라 앞 내용을 살려 같은 경로에 씀)
## 다음 task가 알아야 할 것
- `src/orders/refund.js:34`: `order.points.earned - remainingEarn(order, remainingGoods)`
- 재현 명령과 테스트는 fix.md, `test/refund.test.js` 마지막 테스트
