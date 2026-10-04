---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서 계산은 고치지 않고, 머지로 깨진 creditTotals만 lineVat를 쓰게 고친다"
    why: "견적서는 기준 커밋에서 이미 규칙대로 56,278원이다. npm test 통과가 완료조건이고 팀 지식 docs/knowledge/billing/vat-per-line-floor.md가 반품 전표도 lineVat를 쓰라고 한다"
    by: ai
assumptions:
  - "경리 금액은 줄별 버림 값(56,278원)이라고 본다. 의도의 56,280원은 수정 전 합계 반올림 값이다"
rejected:
  - "quoteTotals 계산 오류: 이미 lineVat로 줄별 버림이며 직접 계산과 일치"
open_questions: []
intent_deviation:
  summary: "의도는 현재 견적 합계가 56,280원이라 했으나 기준 커밋에서는 이미 56,278원이다"
  evidence: "커밋 07c2ebc가 quoteTotals를 줄별 버림으로 고침. Q-0457 실행 결과 vat 3587, total 56278"
risks:
  - "견적서는 수정 전에도 정상이라 실패하는 재현 테스트가 없다. Q-0457 테스트는 회귀 방지용"
  - "문의가 이 수정 전 견적서에 대한 것이라면 이미 발행된 견적서의 저장 totals는 56,280원일 수 있다"
recommended_next: null
knowledge_candidates:
  - "머지 때 creditTotals가 lineVat import만 하고 VAT_RATE_PERCENT 직접 계산을 남겨 반품 전표 테스트가 깨진 적이 있다. 줄별 버림은 lineVat만 쓴다"
---
## 요약
견적서 Q-0457은 기준 커밋에서 이미 규칙대로 56,278원(부가세 3,587원)이다. 대신 머지 때 깨진 `creditTotals`(정의 없는 `VAT_RATE_PERCENT` 참조)를 `lineVat`로 고쳐 `npm test` 54건이 모두 통과한다. Q-0457 합계 테스트도 추가했다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js:94` `lineVat(r.net)` 사용으로 변경
- `test/quote.test.js` 마지막 테스트: Q-0457 기대값 supply 52691, vat 3587, total 56278
- 의도의 56,280원은 합계 반올림(3,589원) 값. 현재 코드와 맞지 않으므로 verify가 의도 편차를 확인할 것
- 테스트: `npm test` (54 통과)
- 팀 지식 vat-per-line-floor.md의 "아직 규칙을 따르지 않는 곳"(creditTotals)이 이번에 해소됨
