---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서 버그가 재현되지 않아 관찰 사실만으로 진행한다"
    why: "사람이 선택 (기준 커밋에서 Q-0457이 이미 56,278원)"
    by: human
  - what: "credit-note.js:93을 lineVat로 한 줄 수정해 npm test를 통과시킨다"
    why: "완료조건 npm test 통과. 범위 확장을 사람이 승인"
    by: human
assumptions: []
rejected:
  - "quote.js에 남은 반올림 문제: 코드와 실행 결과가 이미 줄별 버림 규칙대로임"
open_questions: []
intent_deviation:
  summary: "견적서 합계 56,280원 버그는 기준 커밋에서 이미 고쳐져 있어 재현되지 않는다"
  evidence: "기준 커밋 50b1829에서 createQuote(examples/Q-0457.json).totals.total = 56278 (cb2f714가 수정)"
risks:
  - "견적서 재현 실패로 새 견적서 코드 변경이나 새 테스트는 없다. 기존 vat-per-line 테스트에 의존"
  - "credit-note.js 수정은 intent 범위 밖이지만 사람이 승인함"
  - "견적 번호 형식과 유효 기간 코드는 건드리지 않았고 quote 테스트 통과"
recommended_next: null
knowledge_candidates:
  - "credit-note.js가 VAT_RATE_PERCENT를 import 없이 쓰면 반품 전표 테스트 전체가 ReferenceError로 실패한다. 부가세는 lineVat를 통해 계산한다"
---
## 요약
견적서 Q-0457은 기준 커밋에서 이미 56,278원이라 재현되지 않았다. npm test 실패 6건의 원인인 credit-note.js의 미정의 참조를 lineVat로 고쳐 60개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js:93` (커밋은 `git log -1`)
- 견적서 계산: `src/invoice/quote.js` quoteTotals, 이미 줄별 버림
- 테스트: `npm test` 60/60 통과
- 견적서 코드는 이번에 바꾸지 않았다. verify는 intent 완료조건 중 재현 부분을 이 사실로 판단해야 한다
