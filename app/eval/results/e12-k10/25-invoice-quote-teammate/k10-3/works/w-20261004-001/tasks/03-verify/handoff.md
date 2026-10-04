---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "리뷰 지적이 없어 사람에게 반영 선택을 묻지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "`src/invoice/quote.js:42`와 `src/invoice/credit-note.js`의 `creditTotals`는 합계 반올림 방식이라 청구서와 몇 원 차이가 날 수 있다. 적용 여부는 사람이 정해야 한다"
  - "초안 청구서는 다시 계산하면 값이 달라진다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 완료조건 6개 모두 통과 (`npm test` 50개 통과, INV-2031 합계 29,079원 직접 확인). 바뀐 테스트 파일은 `test/total.test.js` 하나이며 추가만 있어 약화 아님.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 부가세 줄별 버림 규칙과 견적서·반품 전표 적용 미정 사항을 다루는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 수정은 `src/invoice/total.js`의 vat 계산이다. 재현 테스트는 `test/total.test.js` 끝의 2개.
- 견적서·반품 전표에 규칙을 적용할지는 `docs/knowledge/invoice/vat-per-line-floor.md`의 `## 아직 정하지 않은 것`에 있다.
