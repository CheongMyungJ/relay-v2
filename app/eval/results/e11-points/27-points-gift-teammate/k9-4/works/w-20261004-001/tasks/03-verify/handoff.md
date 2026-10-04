---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 차단·권장만 반영 (1번 반영, 2번 미반영)"
    why: "사람이 선택"
    by: human
assumptions:
  - "고객센터 규칙(배송비 제외, 버림)은 O-1042 한 건으로 추정한 것이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "다른 주문의 기대값은 확인하지 못함"
  - "선물하기 적립은 비목표라 일반 주문과 값이 다름"
  - "부분 환불 회수 포인트 변경을 확인하는 새 테스트 없음"
  - "레포 밖 /earn.new 임시 파일을 사람이 지워야 함"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 권장 1건(부분 환불 회수 포인트 버림)을 반영해 커밋했다. 모든 완료조건 통과, `npm test` 21개 통과. PR 초안 `pr.md`를 썼다.
새 지식: docs/knowledge/points/earn-points-rule.md — 맞는 기존 항목이 없는 까닭: docs/knowledge가 비어 있었다
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, `src/orders/refund.js:34`. 테스트: `test/order.test.js` 마지막 항목.
- 확인: `node src/cli.js examples/O-1042.json | grep 적립` → 237P
- `src/gift/gift-points.js`는 규칙을 아직 따르지 않음(범위에서 뺌), 지식 파일에 기록.
