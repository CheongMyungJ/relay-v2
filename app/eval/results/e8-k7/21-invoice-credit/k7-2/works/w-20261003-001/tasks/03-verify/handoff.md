---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/invoice/credit-note.js:90 creditTotals는 합계 반올림이라 반품 부가세가 청구서와 몇 원 어긋날 수 있다. 사람이 범위 밖으로 정했다"
  - "PDF 출력 자체는 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 재현 절차(INV-2031 합계 29,079원)와 `npm test` 48개를 직접 다시 돌려 모든 완료조건 통과. 테스트 파일 변경은 추가뿐이라 약화 아님.
남긴 지식: docs/knowledge/vat-floor-per-line.md, docs/knowledge/discount-before-vat-per-line.md, docs/knowledge/credit-note-vat-separate-copy.md
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` vat 계산. 테스트: `test/total.test.js` 끝 2개
- 범위 밖: `src/invoice/credit-note.js:90`
