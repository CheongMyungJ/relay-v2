---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)을 반영하지 않는다"
    why: "동작에 영향이 없고, 2번은 청구서·반품 전표 계산 변경 금지(비목표)와 닿는다"
    by: human
assumptions: []
rejected:
  - "줄별 버림 식의 공용 함수 추출: 청구서·반품 전표 계산을 바꾸지 않는다는 비목표 때문에 이번 범위 밖"
open_questions: []
intent_deviation: null
risks:
  - "줄별 버림 식이 total.js, credit-note.js, quote.js 세 곳에 복제되어 규칙이 바뀌면 함께 고쳐야 한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건은 모두 사소하고 사람이 반영하지 않기로 했다. 완료조건 7개 모두 통과했다(Q-0457 vat 3,587 / total 56,278 재실행 확인, `npm test` 57건 통과). 테스트 파일 변경은 test/quote.test.js에 2건 추가뿐이라 약화 아님. pr.md를 썼다.
고친 지식: docs/knowledge/invoice/vat-per-line-floor.md — 견적서(quoteTotals)도 같은 규칙으로 `## 규칙`에 추가하고 `## 아직 규칙을 따르지 않는 곳` 절을 삭제, 바뀐 이력 추가
## 다음 task가 알아야 할 것
- 수정: `src/invoice/quote.js:42`, 테스트: `test/quote.test.js`
- 재현: createQuote로 `examples/Q-0457.json` 읽어 totals 출력
- 지식 갱신 커밋 포함
