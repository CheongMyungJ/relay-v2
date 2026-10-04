---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2(테스트 보강)만 반영, 지적 1(여러 번 부분 환불 중복 회수)은 반영하지 않음"
    why: "정산팀 식이 아니라서 추측으로 고치면 안 됨. 남은 위험으로 기록"
    by: human
assumptions: []
rejected:
  - "지적 1 반영: 사람이 정산팀 기준 없는 추측 수정이라며 거절"
open_questions: []
intent_deviation: null
risks:
  - "alreadyRefunded가 있는 여러 번 부분 환불은 누적 회수가 되어 중복 회수일 수 있음. 정산팀 기준 미확인"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. pointsFor가 머지되면 refund.js 계산을 합칠 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 테스트 보강(2)만 반영했다. 모든 완료조건 통과, `npm test` 24개 통과, O-1077/R-0311 132P, 환불 금액 13,130원.
고친 지식: docs/knowledge/points/earn-basis.md — 부분 환불 회수 기준(원래 적립 − 남은 상품 재계산 적립, 버림)과 여러 번 환불 미확인 사항 추가. 기준 브랜치에 없던 파일이라 앞 내용을 살려 같은 경로에 씀.
## 다음 task가 알아야 할 것
- 변경: `src/orders/refund.js` pointsRecovered, 테스트 `test/refund.test.js`(경계 테스트는 커밋 d87e1e4).
- 여러 번 부분 환불 식은 정산팀 확인 전까지 미해결.
