---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 3건(모두 사소)을 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 골랐다"
    by: human
assumptions:
  - "저장된 주문의 points.earned 보존은 코드 경로(order.js:35, refund.js:42)로 판단했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "배송비 제외·내림 기준은 O-1042 한 건의 고객센터 값에서 추론했다. O-1107의 243P도 확인되지 않았다"
  - "선물하기 적립과 부분 환불 회수 포인트(refund.js:34)는 옛 기준(반올림)이다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건(모두 사소)은 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과했고 `npm test`는 23개 통과, O-1042는 237P이다. 바뀐 테스트 파일은 새로 추가한 `test/earn.test.js`뿐이라 약화가 아니다.
새 지식: docs/knowledge/points/earn-rule.md — 적립 규칙을 다루는 기존 항목이 없다
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js:6`, 테스트: `test/earn.test.js`
- 산출물: `verification.md`, `pr.md` (task 디렉터리)
- 지식 파일의 "아직 규칙을 따르지 않는 곳": `src/gift/gift-points.js`, `src/orders/refund.js:34`
