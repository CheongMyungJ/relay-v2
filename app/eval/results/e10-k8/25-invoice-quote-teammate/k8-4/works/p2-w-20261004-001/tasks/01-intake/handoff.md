---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적 부가세에도 줄별 원 단위 버림 규칙을 적용하는 것을 목표로 한다"
    why: "팀 지식 vat-per-line-floor.md가 견적을 아직 규칙을 따르지 않는 곳으로 적었고, 요청은 경리 계산과 다른 합계를 고치는 것이다"
    by: ai
  - what: "Q-0457 기대 합계는 56,278원이다"
    why: "사람이 경리 담당 계산 금액으로 알려 줌. 줄별 버림으로 손계산한 값(공급가액 52,691 + 부가세 995+841+886+865=3,587)과 일치함을 확인함"
    by: human
assumptions:
  - "견적 합계의 부가세 외 항목(공급가액, 할인)은 맞다고 가정했다"
rejected: []
open_questions: []
intent_deviation: null
risks: []
recommended_next: null
knowledge_candidates:
  - "견적서 Q-0457의 경리 기준 합계는 56,278원이며 줄별 버림 부가세 규칙과 일치한다 (사람)"
---
## 요약
견적 Q-0457 합계 불일치를 고치는 bugfix 의도를 정리했다. 견적 번호 형식과 유효 기간 계산은 비목표로 못박았다.
## 다음 task가 알아야 할 것
- 계산은 `src/invoice/quote.js`의 `quoteTotals`이다. 테스트는 `npm test`(node --test)이다.
- 참고 가설(확인 안 됨): 현재 코드는 부가세를 할인 전 합계와 할인 합계에 각각 percentOf로 매겨 줄별 버림 규칙과 다를 수 있다.
- 줄별 버림 Q-0457: 줄 부가세 995+841+886+865=3,587원, 공급가액 52,691원, 합계 56,278원. 경리 금액과 일치한다. 현재 코드 출력은 vat 3,589, total 56,280이다.
- 참고 팀 지식: docs/knowledge/invoice/vat-per-line-floor.md
