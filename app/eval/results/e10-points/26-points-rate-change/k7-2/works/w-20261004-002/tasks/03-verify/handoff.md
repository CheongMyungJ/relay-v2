---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(다회차 환불 중복 회수, 경계 테스트)은 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 선택. 1번은 정산팀 규칙 해석 변경이라 이번 범위 밖"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "다회차 부분 환불에서 이전 회수분과 중복 회수될 수 있음 (alreadyRefunded에 회수 포인트 없음)"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: src/points/earn.js는 지금 반올림과 결제 금액 기준"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건은 사람이 반영하지 않기로 했다. 완료조건 8개 모두 통과, `npm test` 21개 통과, 재현 절차는 132P. 테스트 파일 변경은 케이스 추가뿐이라 약화 아님.
남긴 지식: docs/knowledge/partial-refund-points-recovery.md
## 다음 task가 알아야 할 것
- `src/orders/refund.js:29-36` 회수 계산. 테스트는 `test/refund.test.js` 마지막 케이스, 실행은 `npm test`.
- 다회차 환불 중복 회수는 미해결(risks).
