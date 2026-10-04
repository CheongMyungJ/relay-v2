---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "쿠폰 할인과 사용 포인트는 orderAmounts가 넣은 amounts.coupon, amounts.pointsUsed를 그대로 믿는다 (사용 한도는 assertPointUse가 막는다)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "정산팀이 회수 비율을 정하면 POINT_RECOVER_RATE_PERCENT를 바꿔야 한다"
  - "앞 Work(w-20261004-001, -002)에서 고쳤을 수 있음, 머지 대기. refund.js와 earn.js에서 충돌할 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없었다. 완료조건 8개 모두 통과했고 `npm test` 22건이 통과한다. O-1107은 486P다. 바뀐 테스트 파일 2개는 약화가 아니다.
고친 지식: docs/knowledge/points/earn-base-and-rounding.md — 적립률 2%, 환불 회수 비율을 `POINT_RECOVER_RATE_PERCENT`(1%)로 분리한 것을 규칙과 이력에 더했다. 이 Work 파일은 기준 브랜치에 아직 없는 항목이라 앞 내용을 살려 새로 썼다.
## 다음 task가 알아야 할 것
- 산출물: `tasks/03-verify/verification.md`, `pr.md`
- `src/config.js:9-11`: 적립률 2%, 회수율 1%
- 재현: `examples/O-1107.json`을 `createOrder`로 만들면 `points.earned` 486
- 테스트: `npm test`
