---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, quote.js 삼항식 줄바꿈)을 반영하지 않는다"
    why: "사람이 반영하지 않음을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표·견적서 변경은 원 의도보다 넓지만 사람이 요청함"
  - "면세·영세율 전용 신규 테스트는 없고 기존 테스트에 의존"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건이고 반영하지 않았다. 완료조건 6개 모두 통과, `npm test` 52 pass. 테스트 파일 변경은 추가만 있어 약화 아님.
새 지식: docs/knowledge/billing/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목 없음
새 지식: docs/knowledge/billing/example-json-needs-normalize.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목 없음
## 다음 task가 알아야 할 것
- 부가세 계산: `src/invoice/total.js`의 `lineVat`/`sumLineVat`
- 검증 명령: `npm test`
