---
status: "awaiting_approval"
blocked_reason:
decisions: []
assumptions:
  - "리뷰 지적이 없어 반영할 것을 사람에게 묻지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "적립 기준은 고객센터 값 두 건(O-1042, G-0213)으로만 확인했다"
  - "src/orders/refund.js의 pointsRecovered는 적립 기준과 다르다(비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없고, 완료조건 6건이 모두 통과다. 재현 절차는 218P, `npm test`는 27건 통과다.
고친 지식: docs/knowledge/points/earn-basis.md — gift-points.js를 "아직 규칙을 따르지 않는 곳"에서 빼고 이력을 더했다. refund.js 줄에는 "사람이 범위에서 뺌"을 적었다.
## 다음 task가 알아야 할 것
- 변경은 `src/gift/gift-points.js`와 `test/gift.test.js`뿐이다.
- 재현 명령과 `npm test`를 직접 다시 실행해 확인했다.
- 남은 불일치는 `src/orders/refund.js:34`(`percentOf` 반올림)다.
