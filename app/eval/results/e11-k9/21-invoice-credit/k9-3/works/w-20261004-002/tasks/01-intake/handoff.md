---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 규칙은 팀 지식(줄별 버림)을 따른다"
    why: "팀 지식 vat-per-line-floor.md가 반품 전표에도 적용된다고 명시함"
    by: ai
assumptions:
  - "CN-0112의 올바른 합계는 줄별 버림 규칙으로 계산한 값이며 회계팀 수치와 같을 것이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 creditTotals를 이미 고쳤을 수 있음, 머지 대기. 현재 브랜치 코드는 합계 기준 Math.round로 부가세를 계산함"
  - "이미 발행된 반품 전표의 저장된 totals는 바뀌지 않아 회계팀 대조 건은 별도 처리가 필요할 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 의도를 정리했다. 팀 지식의 부가세 규칙(줄별 버림)과 발행분 불변 규칙을 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: 현재 부가세를 `Math.round(taxable * rate / 100)`로 합계에서 계산함(참고용 관찰, 원인 확정 아님).
- `returnedDiscount`의 금액 할인은 수량 비율 반올림. 부분 반품 시 할인 처리도 확인 필요할 수 있음(가설).
- 참고 지식: `docs/knowledge/invoice/vat-per-line-floor.md`, `docs/knowledge/invoice/issued-invoice-and-format-output.md` (기준 브랜치에 아직 없음, 위 Work 머지 대기).
- 재현 입력: `examples/CN-0112.json`, `examples/INV-2047.json`. 테스트: `npm test`.
