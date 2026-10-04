---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 사소 2건을 반영하지 않는다"
    why: "1번은 취향 차이이고, 2번은 gift-points.js 수정 금지 규칙과 다른 팀 협의 대상이라 범위 밖"
    by: human
assumptions:
  - "G-0213의 기대값 218P는 일반 주문과 같은 규칙의 값이다(고객센터 값으로는 확인하지 못함)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "giftPoints는 src/index.js에서 여전히 export되고 호출처가 없다"
  - "환불 회수 포인트(refund.js)의 percentOf 반올림은 범위 밖이다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이고 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과했다. `npm test`는 24개 통과, G-0213은 218P다. test/gift.test.js는 추가만 있어 약화가 아니다.
고친 지식: docs/knowledge/gift/gift-points-hands-off.md — giftPoints가 이제 호출처 없이 export만 남는다는 현황과 바뀐 이력을 더했다
고친 지식: docs/knowledge/points/earn-base-and-rounding.md — gift-points.js 설명을 gift-points-hands-off.md 참고로 줄였다(한 사실은 한 곳에)
## 다음 task가 알아야 할 것
- `src/gift/gift-order.js:36`: `earnPoints(order)` 호출
- `test/gift.test.js` 끝: G-0213 재현 테스트(218P)
- 테스트: `npm test`
- 결과 문서: verification.md, pr.md
