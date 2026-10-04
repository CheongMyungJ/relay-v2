---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints를 earnPoints에 위임해 규칙을 한 곳으로 모은다"
    why: "intent 제약과 팀 지식 docs/knowledge/earn-points-rule.md, earn-rule-duplicated-copies.md: 같은 식의 복사본이 어긋남의 원인"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js의 포인트 회수는 비목표라 고치지 않았다. 적립이 줄어든 만큼 회수가 적립보다 클 수 있어 확인이 필요하다."
  - "수정 전 만든 선물하기 주문의 저장된 적립은 다시 계산하지 않았다(비목표)."
recommended_next: null
knowledge_candidates:
  - "선물하기 적립(src/gift/gift-points.js)은 결제 금액에 반올림해 일반 주문과 어긋났고, 이제 earnPoints에 위임한다. 배송비 0·쿠폰/포인트 0이면 차이가 안 보여 기존 테스트가 놓쳤다."
---
## 요약
선물하기 적립이 결제 금액(배송비 포함)의 반올림이라 G-0213이 249P였다. `earnPoints`에 위임해 218P가 되게 했고, 재현 테스트 2개를 추가했다. `npm test` 25개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js`(커밋 f583ddd), 테스트: `test/gift.test.js` 11, 12번
- 영수증 출력은 적립 예정 줄(249P → 218P)만 바뀌었다.
- 남은 확인: `src/orders/refund.js` 포인트 회수 줄이 같은 식의 복사본이다(비목표).
- 테스트 명령: `npm test`
