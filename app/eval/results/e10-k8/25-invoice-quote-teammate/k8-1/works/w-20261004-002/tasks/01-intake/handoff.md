---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 금액은 팀 지식의 줄별 버림 부가세 규칙을 기준으로 한다"
    why: "팀 지식 vat-per-line-floor.md가 반품 전표(creditTotals)에도 같은 규칙을 적용한다고 명시"
    by: ai
assumptions:
  - "회계팀의 정확한 기대 금액은 요청에 없어, 팀 지식의 규칙으로 계산한 값을 기대값으로 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 견적과 반품 전표 계산을 고쳤을 수 있음, 머지 대기. 이 브랜치의 creditTotals는 아직 Math.round를 쓴다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액 불일치를 고치는 bugfix 의도 초안을 썼다. 원인과 수정 방법은 적지 않았다.
## 다음 task가 알아야 할 것
- 대상: `src/invoice/credit-note.js`의 `creditTotals`, `returnedDiscount`. 재현 입력은 `examples/CN-0112.json`, `examples/INV-2047.json`
- 테스트: `npm test` (node --test), 관련 `test/credit-note.test.js`
- 참고할 팀 지식(기준 브랜치에는 아직 없음): `docs/knowledge/invoice/vat-per-line-floor.md`, `docs/knowledge/invoice/issued-totals-are-stored.md`, `docs/knowledge/format/output-frozen.md`
