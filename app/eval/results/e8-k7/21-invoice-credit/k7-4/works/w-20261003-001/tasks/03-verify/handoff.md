---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "리뷰 지적이 없어 반영할 것이 없고, 사람 선택을 묻지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이미 저장된 청구서·반품 전표의 totals는 옛 방식 값이라 새 계산과 몇 원 다를 수 있다"
  - "반품 전표 변경은 intent 완료조건 밖의 범위 확대(사람이 fix에서 승인)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 6개 완료조건 모두 통과(`npm test` 50건 통과, INV-2031 vat 2641 / total 29079). 테스트 파일 변경 2개는 추가만 있어 약화 아님. PR 초안은 pr.md.
남긴 지식: docs/knowledge/vat-per-line-floor.md, docs/knowledge/discount-before-vat-per-line.md, docs/knowledge/credit-note-same-vat-rule.md
## 다음 task가 알아야 할 것
- 부가세 계산: `src/invoice/total.js`의 `lineVat`/`vatOfRows`. 청구서(`computeTotals`)와 반품 전표(`creditTotals`)가 함께 쓴다.
- 확인 명령: `npm test`, `node src/cli.js examples/INV-2031.json --totals`.
