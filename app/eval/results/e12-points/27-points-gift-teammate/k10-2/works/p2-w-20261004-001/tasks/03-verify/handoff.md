---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "gift-points.js를 다른 팀과 함께 보는 중이라 변경이 겹칠 수 있다"
  - "이미 저장된 선물 주문의 points.earned는 옛 규칙 값 그대로다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 재현 절차(G-0213 → 218P), `npm test` 24개 통과, 완료조건 6개 모두 통과. 바뀐 테스트 파일은 추가만 있어 약화 아님.
고친 지식: docs/knowledge/points/earn-points-rule.md — src/gift/gift-points.js를 '아직 규칙을 따르지 않는 곳'에서 빼고 바뀐 이력을 더했다
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `earnPoints` 호출 한 줄
- `test/gift.test.js`: G-0213(218P), 35,050원 → 350P
- refund.js의 `pointsRecovered`는 여전히 규칙 미준수(범위 밖)
