---
status: "awaiting_approval"
blocked_reason:
decisions: []
assumptions:
  - "환불 회수 포인트(src/orders/refund.js)는 요청에 없어 이번 범위에서 뺐다"
  - "기대값 218P는 요청에 적힌 고객센터 값을 그대로 썼다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 earn-basis.md의 기준은 고객센터 값 한 건(O-1042)으로 추정한 것이라 다른 주문으로는 확인되지 않았다"
recommended_next: null
knowledge_candidates: []
---
## 요약
G-0213 선물하기 주문의 적립 예정 포인트를 249P에서 218P로 맞추는 bugfix 의도 초안을 썼다. 메시지 카드, 받는 사람, `src/format/`, 이미 적립된 포인트는 비목표로 두었다.
## 다음 task가 알아야 할 것
- 참고(조사 결과, 원인 확정 아님): `docs/knowledge/points/earn-basis.md`에 적립 기준(배송비 제외, 원 단위 미만 버림)이 있다. 이 기준으로 G-0213을 손으로 계산하면 (24,860 - 2,000 - 1,000) = 21,860의 1%, 곧 218P이다.
- 코드: `src/gift/gift-points.js`의 `giftPoints`는 `percentOf(order.amounts.total, POINT_RATE_PERCENT)`를 쓴다. 같은 지식 항목에 `src/orders/refund.js`의 `pointsRecovered`도 기준이 다를 수 있다고 적혀 있으나 이번 범위 밖이다.
- 테스트 명령: `npm test` (`node --test`)
