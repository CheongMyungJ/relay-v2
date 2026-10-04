---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)은 반영하지 않음"
    why: "사람이 '반영하지 않음'을 골랐다"
    by: human
  - what: "test/order.test.js의 기대값 500→1000은 약화 아님으로 판정"
    why: "상품 50,000원 × 2%의 직접 결과이고 단언은 유지됨"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "환불 회수는 환불 상품 금액의 1% 반올림 그대로라 2% 주문과 어긋남. 정산팀 결정 대기"
  - "앞 Work(w-20261004-001/002)에서 고쳤을 수 있음, 머지 대기: earn.js·refund.js 수정이 이 브랜치에 없어 충돌 가능"
  - "음수 기준 금액 방어와 내림 경계 테스트는 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(사소)은 사람이 반영하지 않기로 했다. 완료조건 5개 모두 통과, `npm test` 21 pass. 재현 명령은 O-1107 = 486P. 바뀐 테스트 파일은 test/order.test.js 하나이고 약화 아님.
고친 지식: docs/knowledge/points/earn-rule.md — 앞 Work의 내용을 살려 2% 적립률, 저장값 재계산 안 함을 규칙에 더하고, 환불 회수 계산 줄은 규칙에서 빼 미정 항목으로 옮김. 선물하기·환불 회수 새 적립률 미정을 더함
## 다음 task가 알아야 할 것
- `src/config.js`: `POINT_RATE_PERCENT=2`, `REFUND_RECOVER_RATE_PERCENT=1`, `GIFT_POINT_RATE_PERCENT=1`
- `src/points/earn.js:6`: 적립 계산(내림)
- 산출물: tasks/03-verify/verification.md, pr.md
