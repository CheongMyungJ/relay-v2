---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, 필터 중복)은 반영하지 않는다"
    why: "사람이 반영하지 않음을 선택"
    by: human
assumptions:
  - "보고된 56,280원은 옛 계산값이라고 추정하며 확인하지 못함. 규칙 값은 56,278원"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "total.js(청구서) 호출 수정은 비목표와 걸치지만 사람이 포함하기로 결정했고 발행된 청구서는 저장된 totals를 씀"
  - "docs/knowledge/invoice/에 내용이 겹치는 항목 쌍이 있음(format-output-*, issued-*)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건이었고 사람이 반영하지 않기로 했다. 완료조건 5개 모두 통과했고 npm test 52개가 통과한다. Q-0457은 부가세 3,587원, 합계 56,278원이다.
고친 지식: docs/knowledge/invoice/vat-per-line-floor.md — sumLineVat이 과세 줄 net 숫자 배열을 받는다는 규칙과 바뀐 이력을 더함
## 다음 task가 알아야 할 것
- 수정: src/invoice/quote.js:39, src/invoice/total.js:26
- 재현 테스트: test/quote.test.js:34
- 변경된 테스트 파일 없음
