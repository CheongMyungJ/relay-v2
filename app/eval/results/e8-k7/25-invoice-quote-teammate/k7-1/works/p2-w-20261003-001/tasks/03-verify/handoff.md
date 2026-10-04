---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 없음, 반영할 것 없음"
    why: "변경이 원인·의도와 맞고 비목표(번호·유효기간·청구서·반품 전표)를 건드리지 않음"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "경리 원본 값과 직접 대조하지 못함"
  - "규칙 변경 전에 저장된 견적서 totals는 옛 값이 남을 수 있음"
  - "줄별 버림 식이 세 파일에 복제됨"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 완료조건 6개 모두 통과(재현 명령 vat 3587/합계 56278, `npm test` 55개 통과). 지식 파일의 "견적서는 아직 반올림" 서술을 현재 상태로 고쳐 커밋했다.
남긴 지식: docs/knowledge/vat-also-computed-in-quote-and-credit-note.md
## 다음 task가 알아야 할 것
- 부가세 규칙 변경 시 `src/invoice/total.js`, `quote.js`, `credit-note.js` 세 곳을 함께 바꾼다.
- 바뀐 테스트 파일은 `test/quote.test.js`(추가만).
