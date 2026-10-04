---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(quoteTotals와 computeTotals 식 중복, 사소)을 반영하지 않는다"
    why: "합치려면 청구서 코드를 바꿔야 해 비목표와 충돌한다"
    by: human
assumptions: []
rejected:
  - "quoteTotals를 lineAmounts로 합치기: 비목표(청구서 계산 불변)와 충돌"
open_questions: []
intent_deviation: null
risks:
  - "Q-0457이 이미 56,280원으로 안내되었다면 정정 안내가 필요하다"
  - "quoteTotals와 computeTotals가 같은 식을 따로 가져 규칙이 바뀌면 두 곳을 고쳐야 한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건이었고 사람이 반영하지 않기로 했다. 완료조건 6개를 최종 코드에서 모두 통과로 판정했다. 재현 결과는 부가세 3,587원, 합계 56,278원이고 `npm test`는 55개 통과다.
고친 지식: docs/knowledge/invoice/vat-per-line-floor.md — 견적서도 같은 규칙이라고 적고, 고친 quote.js를 "아직 규칙을 따르지 않는 곳"에서 지웠으며 바뀐 이력을 더했다.
## 다음 task가 알아야 할 것
- `src/invoice/quote.js` `quoteTotals`: 줄별 버림. 청구서 `src/invoice/total.js` `computeTotals`와 같은 식
- 검증 명령: `npm test`, 재현은 `createQuote(examples/Q-0457.json).totals`
- 변경된 테스트 파일은 `test/quote.test.js`뿐이며 약화 아님
- PR 초안: `tasks/03-verify/pr.md`
