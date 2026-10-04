---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "리뷰 지적이 없어 반영할 지적 선택 질문은 생략했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "quote.js와 credit-note.js는 반올림 방식이라 청구서와 부가세가 몇 원 다를 수 있음(비목표라 유지)"
recommended_next: null
knowledge_candidates: []
---
## 요약
변경을 리뷰했고 지적은 없었다. 재현 절차(INV-2031 → 29,079원)와 `npm test`(50건 통과)를 직접 다시 돌려 완료조건 7개를 모두 통과로 판정했다. 테스트 파일은 추가만 있어 약화가 아니다. pr.md를 썼다.
남긴 지식: docs/knowledge/vat-per-line-floor-after-discount.md, docs/knowledge/issued-invoice-keeps-stored-totals.md, docs/knowledge/vat-also-computed-in-quote-and-credit-note.md
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` computeTotals의 vat
- 재현: `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079
- 발행분: `src/invoice/invoice.js` invoiceTotals는 변경 없음
