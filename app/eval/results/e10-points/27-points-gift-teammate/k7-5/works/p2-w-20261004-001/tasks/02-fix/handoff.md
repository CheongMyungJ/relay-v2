---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 호출해 일반 주문과 계산을 공유한다"
    why: "완료조건: 같은 금액이면 일반 주문과 선물 적립이 같아야 한다. 변경이 gift-points.js 안에 머문다"
    by: ai
  - what: "percentOf와 earn.js, refund.js는 건드리지 않는다"
    why: "팀 지식 docs/knowledge/gift-points-hands-off.md, 비목표"
    by: ai
assumptions:
  - "다른 팀과의 합의 여부는 확인되지 않았고, 사람의 허용에 따라 진행했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립은 다른 팀이 같이 보는 중이라 그 팀의 작업과 충돌할 수 있다"
  - "선물 주문 환불 회수(refund.js)는 반올림이라 1P 어긋날 수 있다. 범위 밖"
  - "earn.js가 바뀌면 선물 적립도 함께 바뀐다"
recommended_next: null
knowledge_candidates: []
---
## 요약
`giftPoints`가 배송비를 포함하고 반올림해 G-0213이 249P로 나오던 것을, `earnPoints`를 호출하게 바꿔 218P로 고쳤다. 재현 테스트를 추가했고 `npm test`는 23개 통과다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: 전체가 `earnPoints(order)` 호출
- `test/gift.test.js`: G-0213 테스트 추가 (수정 전 249로 실패 확인)
- 변경 소스 파일은 gift-points.js 하나. 이미 저장된 주문은 재계산하지 않음
