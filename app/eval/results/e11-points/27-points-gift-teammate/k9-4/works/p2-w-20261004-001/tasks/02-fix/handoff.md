---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 재사용하게 했다"
    why: "팀 지식 docs/knowledge/points/earn-points-rule.md: 일반 주문과 같은 규칙, percentOf 금지"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "docs/knowledge/points/earn-points-rule.md의 '아직 규칙을 따르지 않는 곳'에 gift-points.js가 남아 있어 갱신이 필요하다"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-points-rule.md — src/gift/gift-points.js도 earnPoints를 쓰도록 고쳤으니 '아직 규칙을 따르지 않는 곳'에서 뺀다"
  - "새 적립 경로는 percentOf 대신 earnPoints를 재사용한다. 배송비 0인 테스트만으로는 반올림/배송비 포함 오류가 드러나지 않는다"
---
## 요약
선물 적립이 배송비 포함 total에 반올림을 써서 G-0213이 249P였다. earnPoints를 재사용해 218P가 된다. 재현 테스트 2개를 추가했고 npm test 23개가 통과한다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: earnPoints 위임
- `test/gift.test.js`: 새 테스트 2개 (수정 전 실패 확인)
- 메시지, 받는 사람, amounts, 영수증 코드는 건드리지 않았다.
