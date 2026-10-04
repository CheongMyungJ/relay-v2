---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(공용 함수 추출)은 반영하지 않고 2(테스트 제목)만 반영한다"
    why: "사람이 2번만 반영하도록 골랐다"
    by: human
assumptions: []
rejected:
  - "지적 1 공용 함수 추출: 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "견적·반품 전표는 회계/경리 실제 계산값과 비교하지 않았다"
  - "견적 규칙 변경으로 이미 보낸 견적과 vat가 1~3원 다를 수 있다"
  - "줄별 버림 식이 3곳에 중복되어 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
모든 완료조건 통과. 지적 2건(모두 사소) 중 테스트 제목 수정만 반영했고 `npm test` 51 통과. 테스트 파일 변경은 모두 약화 아님. `pr.md` 작성.
새 지식: docs/knowledge/accounting/vat-rounding.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
새 지식: docs/knowledge/invoice/issued-invoice-and-format.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
## 다음 task가 알아야 할 것
- 검증 명령: `node src/cli.js examples/INV-2031.json --totals` (29079), `node src/cli.js examples/CN-0112.json --invoice examples/INV-2047.json` (19180), Q-0457 (56278).
- 부가세 식: `src/invoice/total.js`, `quote.js`, `credit-note.js:90`.
