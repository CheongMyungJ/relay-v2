---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)은 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "고객센터 적립 안내 규칙은 문서 없이 사람 말에만 의존한다"
  - "예전 반올림 저장 주문의 부분 환불 회수가 저장된 earned와 최대 1P 어긋날 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이고 반영하지 않았다. 완료조건 7개 모두 통과, `npm test` 25건 통과. 테스트 파일 3개는 추가만 있어 약화 아님.
새 지식: docs/knowledge/points/earn-rule.md — 적립 규칙을 다루는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 규칙 위치: `src/points/earn.js`(`earnBase`, `earnOnBase`), `src/money.js` `floorPercentOf`
- 환불 회수: `src/orders/refund.js` `baseBefore`/`baseAfter` 차이
- O-1042 → 237, G-0213 → 218
