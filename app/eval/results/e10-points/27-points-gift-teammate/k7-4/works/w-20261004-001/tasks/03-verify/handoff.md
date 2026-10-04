---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(부분 환불 회수 refund.js:34 어긋남)은 반영하지 않는다"
    why: "intent가 적립 계산만 다루고 환불 회수 규칙은 정해진 바 없어 범위를 넘는다. 남은 위험으로 기록"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js:34 부분 환불 회수는 옛 반올림 방식이라 적립보다 많이 회수될 수 있다"
  - "src/gift/gift-points.js는 옛 방식 그대로다(비목표)"
  - "이미 저장된 points.earned는 바뀌지 않아 이전 주문과 기준이 다르다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(부분 환불 회수 불일치, 권장)은 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과: O-1042 237P, npm test 23개 통과, 변경 테스트는 신규 파일뿐, format과 gift 무변경.
남긴 지식: docs/knowledge/earn-points-rule.md, docs/knowledge/earn-rule-duplicated-copies.md
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, 테스트: `test/earn.test.js`
- 후속 후보: `src/orders/refund.js:34`, `src/gift/gift-points.js`를 새 규칙에 맞출지 별도 Work로 결정
