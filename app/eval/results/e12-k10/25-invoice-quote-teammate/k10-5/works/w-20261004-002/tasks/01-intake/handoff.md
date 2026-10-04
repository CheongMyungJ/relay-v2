---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세에 팀 지식의 줄별 원 단위 버림 규칙을 적용하는 것으로 의도를 적었다"
    why: "팀 지식 vat-rounding.md가 반품 전표(`creditTotals`)에도 같은 규칙이라고 적고 있음"
    by: ai
assumptions:
  - "회계팀 계산은 팀 지식의 줄별 버림 규칙과 같다고 가정함 (회계팀의 정확한 기대값은 요청에 없음)"
  - "청구서와 견적서 계산은 이번 요청 범위 밖으로 둠"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목은 앞 Work(w-20261004-001)에서 왔고 머지 대기 중이다. 그 Work가 청구서와 견적서를 고쳤을 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 몇 원 어긋나는 버그의 의도 초안을 썼다. 팀 지식의 줄별 버림 규칙을 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js`의 `creditTotals`: 부가세를 과세분 합계에 한 번 `Math.round`로 계산한다(`vat` 줄). 원인이라는 확정은 아니며 fix에서 확인한다.
- `returnedDiscount`: 금액 할인 부분 반품은 `Math.round`, 비율 할인은 `percentOf`를 쓴다. 이 값도 어긋남에 관여하는지 fix에서 확인한다.
- 예시: `examples/CN-0112.json`, `examples/INV-2047.json`. 테스트: `npm test`(`node --test`), `test/credit-note.test.js`
- 참고 팀 지식: `docs/knowledge/billing/vat-rounding.md` (기준 브랜치에 아직 없음)
