---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트는 팀 규칙(환불 전 기준액 적립 − 환불 후 기준액 적립, 버림)을 따른다"
    why: "팀 지식 earn-rule.md의 규칙이 부분 환불 회수를 직접 덮는다. 다시 묻지 않음"
    by: ai
assumptions:
  - "범위는 부분 환불(createRefund)만이다. 적립/선물하기 코드는 요청 밖이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/points/earn.js, src/gift/gift-points.js는 아직 결제금액 반올림을 쓴다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "기준 브랜치에는 earnBase, earnOnBase, floorPercentOf가 아직 없다. 앞 Work 머지 전이면 이번 수정에서 필요한 함수를 직접 만들어야 해 충돌 가능"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트를 팀 적립 규칙(배송비 제외 기준액, 원 단위 버림, 환불 전후 적립 차이)에 맞추는 버그 수정 의도를 정리했다. 질문 없이 초안을 썼다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js:34`: 현재 `percentOf(refundGoods, POINT_RATE_PERCENT)`로 환불 상품금액만 반올림한다.
- `src/money.js:14`: `percentOf`는 `Math.round`를 쓴다.
- 예시: `examples/O-1077.json`, `examples/R-0311.json`. 기대 132P (403 − 271), 현재 131P.
- 참고 지식: `docs/knowledge/points/earn-rule.md` (기준 브랜치에는 없음, 앞 Work 머지 대기).
- 테스트: `npm test`. `test/refund.test.js`가 있다.
