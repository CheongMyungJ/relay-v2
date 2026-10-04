---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적 부가세는 청구서와 같은 줄별 버림 규칙을 쓰고, 영세율 견적은 0으로 한다"
    why: "intent 제약과 팀 지식 docs/knowledge/invoice/vat-per-line-floor.md. 경리 금액 56,278원과 일치"
    by: ai
  - what: "청구서 `computeTotals`의 같은 버그는 고치지 않는다"
    why: "intent 비목표"
    by: ai
assumptions:
  - "견적서에 줄별 버림 규칙 적용은 확정이 아니다. 경리 금액과의 일치만 근거다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "npm test 9건 실패가 남음(기준 커밋에서도 실패). `computeTotals`가 같은 방식으로 객체를 넘김(total.js:31). 별도 Work 필요"
  - "요청의 56,280원 출처는 확인하지 못함"
recommended_next: null
knowledge_candidates:
  - "경리 계산 Q-0457 합계는 56,278원이다 (사람)"
  - "정하지 않음: 견적서 부가세에 줄별 버림 규칙 적용이 확정인지 — 요청자는 모르고 청구서를 맞춘 동료가 휴가 중, 지금 코드는 줄별 버림 적용, 경리 금액과 일치 (사람)"
  - "아직 규칙을 따르지 않음: src/invoice/total.js computeTotals — lineVat에 객체를 넘겨 면세·영세율이 깨짐, 사람이 이번 범위에서 뺌 (사람)"
  - "실패 유형: lineVat(net, taxable)의 두 번째 인자는 불리언이다. 객체를 넘기면 항상 참이 된다 (src/invoice/total.js:17)"
---
## 요약
`quoteTotals`가 `lineVat`에 객체를 넘겨 면세 줄에도 부가세가 붙고 영세율이 무시되던 것을 고쳤다. Q-0457 합계가 56,278원이 된다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/quote.js:39`
- `node --test test/quote.test.js` 4건 통과. `npm test`는 pass 46 / fail 9(수정 전 11).
- 남은 9건은 기준 커밋에서도 실패. `src/invoice/total.js:31` `computeTotals`가 같은 객체 전달 버그. 비목표라 그대로 둠.
