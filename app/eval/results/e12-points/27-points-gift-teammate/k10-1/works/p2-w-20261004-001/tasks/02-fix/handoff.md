---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints를 earnPoints에 위임해 일반 주문과 같은 코드 경로를 쓴다"
    why: "docs/knowledge/points/earn-basis.md 규칙이 이번 경우를 덮고, 기준을 한 곳에서만 관리하게 된다"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "refund.js의 부분 환불 회수는 여전히 적립 기준과 다름(이번 범위 아님)"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립(src/gift/gift-points.js)은 earnPoints에 위임하도록 고침. 쿠폰·포인트가 없고 금액이 딱 떨어지는 주문에서는 옛 방식과 값이 같아 테스트로 드러나지 않았음"
---
## 요약
`giftPoints`가 총액 반올림으로 따로 계산하던 것을 `earnPoints` 호출로 바꿨다. G-0213은 249P에서 218P가 됐고 `npm test` 23개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js`, 재현 테스트: `test/gift.test.js` 마지막 테스트
- 이미 적립된 주문은 `createGiftOrder` 호출 때만 계산되어 저장값을 다시 계산하지 않음
- 지식 문서 earn-basis.md의 "아직 규칙을 따르지 않는 곳"에서 gift-points.js 항목은 이제 해소됨
