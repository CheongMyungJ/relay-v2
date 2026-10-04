---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 줄마다 Math.floor 후 합산으로 바꾸고 청구서(total.js)는 건드리지 않는다"
    why: "docs/knowledge/invoice/vat-per-line-floor.md 규칙과 intent 비목표"
    by: ai
  - what: "저장된 totals는 재계산하지 않는다(creditNoteTotals 그대로)"
    why: "docs/knowledge/invoice/issued-invoice-totals-frozen.md"
    by: ai
assumptions:
  - "net이 음수인 줄은 없다고 보았다(Math.floor는 음수에서 0 쪽이 아니라 아래로 내림)"
rejected:
  - "returnedDiscount 오차: 공급가액 합은 이미 맞고 부가세만 2원 차이"
open_questions: []
intent_deviation: null
risks:
  - "청구서 computeTotals(src/invoice/total.js)는 여전히 합계에 Math.round 한다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "반품 전표 creditTotals도 부가세를 과세 줄마다 절사해 합산하도록 고쳤다. 이제 vat-per-line-floor.md의 '아직 규칙을 따르지 않는 곳'에서 뺀다. CN-0112 합계 19,180원, 부가세 1,742원"
---
## 요약
`creditTotals`가 부가세를 합계에 한 번 반올림해 CN-0112가 19,182원이었다. 줄별 절사 합산으로 고쳐 19,180원이 된다. 재현 테스트 3개를 추가했고 `npm test` 49개 모두 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals` vat 줄.
- 테스트: `test/credit-note.test.js` 끝의 3개. 수정 전 2개 실패 확인.
- 이 브랜치의 `src/invoice/total.js`는 아직 Math.round(앞 Work 머지 대기). 비목표라 건드리지 않음.
