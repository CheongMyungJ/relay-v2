---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints를 earnPoints에 위임한다"
    why: "intent: 일반 주문과 같은 기준. 기준을 복제하지 않아 어긋날 수 없다 (docs/knowledge/points/earn-points-basis.md)"
    by: ai
  - what: "공유 파일 src/gift/gift-points.js를 수정한다"
    why: "intake에서 사람이 허용함 (docs/knowledge/points/gift-points-ownership.md의 예외)"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "gift-points.js는 다른 팀과 공유 파일이다. 다른 팀과의 합의는 확인되지 않았다"
  - "선물하기 적립이 배송비 제외·버림으로 바뀌어 다른 선물 주문의 적립도 달라진다"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립 `giftPoints`는 `earnPoints`에 위임해 일반 주문과 같은 기준이 되었다. earn-points-basis.md의 '아직 규칙을 따르지 않는 곳'에서 gift-points 항목을 지울 수 있다"
  - "고칠 지식: docs/knowledge/points/gift-points-ownership.md — G-0213 건은 리포트가 지목한 이 팀의 일이라 사람이 수정을 허용했다 (사람)"
---
## 요약
G-0213 적립 예정이 249P였던 원인은 `giftPoints`가 배송비 포함 total을 반올림했기 때문이다. `earnPoints`에 위임해 218P가 나오게 고치고 테스트를 추가했다. `npm test` 23개 통과.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `earnPoints` 위임
- `test/gift.test.js`: G-0213 218P 테스트 (수정 전 249로 실패 확인)
- `src/format/`, `points.earned` 재계산 코드는 건드리지 않음
