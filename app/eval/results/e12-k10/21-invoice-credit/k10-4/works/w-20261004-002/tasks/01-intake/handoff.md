---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 팀 지식의 줄 단위 버림 규칙을 따른다"
    why: "팀 지식 vat-per-line-floor.md: 청구서와 반품 전표 모두 같은 규칙"
    by: ai
assumptions:
  - "회계팀이 기대하는 금액은 팀 지식 규칙으로 계산한 값이라고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: `lineVat`/`sumLineVat`이 이 브랜치에 아직 없을 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 부가세는 팀 지식의 줄 단위 버림 규칙을 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js`의 `creditTotals`는 부가세를 `Math.round(taxable * 세율 / 100)`로 합계에서 한 번 반올림한다(팀 지식 규칙과 다름. 확정된 원인 아님, 참고용).
- `returnedDiscount`의 금액 할인 안분도 반올림을 쓴다. 회계 기준은 확인 필요.
- 팀 지식 `docs/knowledge/billing/vat-per-line-floor.md`는 기준 브랜치에 아직 없고, `src/invoice/total.js`에 `lineVat`/`sumLineVat`이 있는지 확인할 것.
- 테스트: `npm test`(node --test), 관련 `test/credit-note.test.js`.
