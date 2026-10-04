---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 회수량은 요청의 132P(O-1077/R-0311)로 한다"
    why: "요청에 정산팀 계산값으로 명시됨"
    by: human
assumptions:
  - "정산팀의 계산 방식은 요청에 없다. 기대값 132P만 근거로 삼았다"
  - "여러 번 부분 환불해도 합이 맞아야 한다는 항목은 요청의 취지(1~2P 불일치)에서 추정했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 earn-rule.md, partial-refund-recovery.md는 앞 Work(w-20261004-001)에서 왔고 머지 대기다. 이 브랜치의 src/points/earn.js에는 earnBase/earnOn이 아직 없고 earnPoints만 있다. 앞 Work에서 이미 고쳤을 수 있음, 머지 대기"
  - "옛 규칙으로 저장된 주문은 저장된 적립과 회수량이 맞지 않을 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불의 포인트 회수가 정산팀 계산과 1~2P 어긋나는 버그의 의도 초안을 썼다. 기대값은 O-1077/R-0311에서 132P(현재 131P)이고, 환불 금액, 영수증 글자, 이미 처리한 적립과 환불은 건드리지 않는다.
## 다음 task가 알아야 할 것
- 회수 계산 위치: `src/orders/refund.js:34` (`pointsRecovered`). 전체 취소는 `:42`.
- 참고 지식(원인 근거는 아님): `docs/knowledge/points/partial-refund-recovery.md`, `docs/knowledge/points/earn-rule.md`. 기준 브랜치에는 아직 없다.
- 예시 값: O-1077 상품 47,310 / 쿠폰 5,000 / 사용 포인트 2,000 / 저장된 적립 403P. R-0311은 SP-0656 ×2 환불(13,130원). 정산팀 기대 132P.
- 테스트: `npm test`(`node --test`). 기존 `test/refund.test.js:20`은 회수 100P를 기대한다.
