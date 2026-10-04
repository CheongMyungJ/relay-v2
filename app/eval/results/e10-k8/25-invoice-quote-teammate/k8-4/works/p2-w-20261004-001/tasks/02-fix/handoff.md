---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적 부가세를 청구서 computeTotals와 같은 줄별 원 단위 버림 식으로 바꾼다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md 규칙과 intent 제약"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "README.md의 규칙 문구를 견적서도 따른다고 고쳤다(팀 지식 문서는 verify에서 갱신)"
recommended_next: null
knowledge_candidates:
  - "견적 부가세(src/invoice/quote.js quoteTotals)도 줄별 원 단위 버림 규칙을 따르도록 고쳤다. 예: Q-0457 부가세 3,587원, 합계 56,278원 (Work w-20261004-001)"
---
## 요약
견적 부가세가 할인 전·할인 합계에 각각 반올림하던 방식이라 Q-0457이 2원 많았다. 과세 줄마다 버림하는 방식으로 고쳐 56,278원이 되었다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/quote.js` quoteTotals. 테스트 추가: `test/quote.test.js` (Q-0457, 영세율)
- `npm test` 57건 통과
- 견적 번호 검사와 유효 기간 함수는 변경 없음
- 팀 지식의 "아직 규칙을 따르지 않는 곳"에서 quote.js를 뺄 차례
