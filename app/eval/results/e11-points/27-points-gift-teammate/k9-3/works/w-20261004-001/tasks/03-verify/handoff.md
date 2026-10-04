---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(환불 회수 반올림, 버림 경계 테스트)을 반영하지 않는다"
    why: "환불 회수는 이번 범위 밖이고, 버림은 O-1042 테스트가 이미 검증한다"
    by: human
assumptions:
  - "고객센터 계산 기준(배송비 제외, 버림)은 O-1042 한 건에서 역산한 것"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js:34 부분 환불 회수 포인트는 반올림이라 적립과 어긋날 수 있음"
  - "src/gift/gift-points.js는 옛 식 그대로(비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
변경 전체를 리뷰했고 지적 2건(권장 1, 사소 1)은 사람이 반영하지 않기로 했다. 완료조건 6개는 모두 통과했다(`npm test` 22/22, O-1042 237P). 테스트 파일 변경은 새 test/earn.test.js뿐이며 약화 아님이다.
새 지식: docs/knowledge/points/earn-base-and-rounding.md — 적립 기준과 버림 규칙을 다루는 기존 항목이 없음
새 지식: docs/knowledge/points/stored-points-earned.md — 저장된 points.earned를 쓰는 규칙(사람)을 다루는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, 테스트: `test/earn.test.js`
- 환불 회수 `src/orders/refund.js:34`(반올림)과 선물하기 `src/gift/gift-points.js`는 적립 규칙과 어긋나 있어 지식 항목에 "아직 따르지 않는 곳"으로 적음
