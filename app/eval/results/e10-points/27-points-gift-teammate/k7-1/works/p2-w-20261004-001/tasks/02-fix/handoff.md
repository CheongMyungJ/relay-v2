---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 그대로 재사용한다"
    why: "팀 지식 docs/knowledge/earn-points-base-and-rounding.md: 적립은 배송비 제외, 원 단위 버림"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수(refund.js)는 여전히 반올림 percentOf라 적립과 어긋날 수 있다(비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
선물하기 적립이 배송비 포함 총액에 반올림을 써서 249P가 나왔다. `earnPoints`를 재사용하도록 고쳐 218P가 나온다. 재현 테스트를 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js`
- 테스트: `test/gift.test.js` 마지막 테스트. `npm test` 24개 통과
- 영수증 출력은 G-0213의 적립 예정 줄(249P에서 218P)만 달라진다. 메시지 카드, 받는 사람, `src/format/`은 변경 없음
