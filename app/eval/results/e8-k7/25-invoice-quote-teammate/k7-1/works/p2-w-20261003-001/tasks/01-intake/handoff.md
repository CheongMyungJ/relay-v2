---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서 부가세에 청구서와 같은 줄별 버림 규칙을 적용하는 것으로 의도를 잡음"
    why: "경리 계산과 다르다는 문의이고, 팀 지식에 회계팀 규칙이 있으며 견적서만 아직 반올림 방식이라고 기록됨"
    by: ai
assumptions:
  - "경리 계산 금액은 줄별 버림 규칙으로 나온 값이라고 가정함. 정확한 경리 금액은 요청에 없음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "요청에 경리 금액이 없어 수정 후 합계를 경리 값과 직접 대조하지 못함"
recommended_next: null
knowledge_candidates: []
---
## 요약
견적서 Q-0457 합계가 경리 계산과 다른 버그의 의도 초안을 썼다. 견적 번호 형식과 유효 기간은 비목표로 못 박았다.
## 다음 task가 알아야 할 것
- 계산 위치: `src/invoice/quote.js`의 `quoteTotals`. 데이터: `examples/Q-0457.json`. 테스트: `test/quote.test.js`, `npm test`.
- 참고 지식: `docs/knowledge/vat-also-computed-in-quote-and-credit-note.md` (견적서는 아직 반올림 방식), `docs/knowledge/vat-per-line-floor-after-discount.md`.
- 참고 지식: `docs/knowledge/issued-invoice-keeps-stored-totals.md` (발행된 문서는 저장된 합계를 쓴다). 견적서에도 저장된 totals가 있는지 fix에서 확인할 것.
