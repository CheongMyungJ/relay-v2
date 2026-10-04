---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서 부가세를 할인 후 공급가액 줄마다 Math.floor로 계산해 합산한다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md 규칙. 청구서 computeTotals와 같은 식"
    by: ai
assumptions:
  - "할인 줄은 할인 후 공급가액(net)에 줄별 버림을 적용하는 것이 규칙에 맞다고 본다 (청구서와 같음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "Q-0457이 이미 거래처에 56,280원으로 안내되었을 수 있어 정정 안내가 필요할 수 있다"
recommended_next: null
knowledge_candidates:
  - "견적서 부가세도 줄별 버림 규칙을 따르도록 src/invoice/quote.js를 고침 (Work w-20261004-001). 아직 규칙을 따르지 않는 곳에서 뺄 것"
---
## 요약
견적서 부가세가 합계 기준 반올림이라 Q-0457이 56,280원으로 나왔다. 줄별 버림으로 바꿔 56,278원(부가세 3,587원)이 되었다.
## 다음 task가 알아야 할 것
- `src/invoice/quote.js` `quoteTotals`: 청구서 `computeTotals`와 같은 식으로 변경
- 테스트: `test/quote.test.js`에 Q-0457 합계, 영세율/면세 추가. `npm test` 55개 통과
- 번호 형식, `quoteValidUntil`은 건드리지 않음
