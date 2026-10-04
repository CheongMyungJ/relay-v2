---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "부가세를 줄별 버림 합산으로 creditTotals 안에서 직접 계산한다"
    why: "docs/knowledge/invoice-vat-per-line-floor.md 규칙. lineVat(src/invoice/total.js)은 이 브랜치에 아직 없어 쓰지 않음"
    by: ai
assumptions: []
rejected:
  - "returnedDiscount의 Math.round가 원인: 이 예시는 전량 반품이라 할인 반올림과 무관"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 lineVat을 추가했을 수 있음, 머지 대기. 머지 뒤 creditTotals를 lineVat으로 합칠 수 있음"
  - "저장된 totals가 있는 기존 반품 전표는 재계산하지 않으므로 이전 금액 그대로임(의도대로)"
recommended_next: null
knowledge_candidates: []
---
## 요약
`creditTotals`가 과세 합계에 한 번 반올림하던 것을 줄별 버림 합산으로 바꿨다. CN-0112는 19,182원에서 19,180원이 된다. 재현 테스트를 추가했고 `npm test`는 50개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js`의 `creditTotals` (vat 계산)
- 테스트: `test/credit-note.test.js` 끝의 새 테스트 2개
- `src/format/`은 변경 없음. 면세, 영세율, 저장된 totals 우선 동작은 그대로다.
- `computeTotals`(src/invoice/total.js)는 같은 모양이지만 앞 Work 담당이라 건드리지 않았다.
