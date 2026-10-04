---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "Q-0457의 기대 합계를 56,278원으로 완료조건에 넣는다"
    why: "경리 담당이 계산한 금액이라고 사람이 알려 줌"
    by: human
assumptions:
  - "경리 계산은 팀 지식의 부가세 규칙(줄마다 할인 후 금액, 원 단위 버림 합산)을 따른다고 가정했다. 경리 합계 56,278원이 이 규칙의 결과인지는 확인하지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "규칙대로 계산한 값이 56,278원과 다르면 규칙 해석과 경리 계산 중 어디가 다른지 fix에서 다시 확인해야 한다"
recommended_next: null
knowledge_candidates:
  - "견적 Q-0457의 경리 담당 계산 합계는 56,278원이다 (사람)"
  - "견적 번호 형식(Q-0000)과 유효 기간 계산은 영업 시스템이 그대로 읽으므로 바꾸면 안 된다 (사람)"
---
## 요약
견적 Q-0457 합계가 경리 계산과 다르다는 버그의 intent 초안을 썼다. 팀 지식의 부가세 규칙을 제약으로 옮기고, 견적 번호와 유효 기간은 비목표로 두었다.
## 다음 task가 알아야 할 것
- 코드: `src/invoice/quote.js`의 `quoteTotals`, 데이터: `examples/Q-0457.json`
- 현재 합계 56,280원, 경리 계산 56,278원(사람이 알려 줌). 테스트는 `npm test`(node --test)
- 참고 지식: `docs/knowledge/vat-floor-per-line.md`, `docs/knowledge/discount-before-vat.md`
