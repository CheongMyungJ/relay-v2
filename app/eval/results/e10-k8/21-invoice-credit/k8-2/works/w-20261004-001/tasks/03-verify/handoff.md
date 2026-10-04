---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, 할인 줄 부가세 테스트 없음)을 반영한다"
    why: "사람이 '모두 반영'을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "영세율 반품 전표 테스트는 수정 전에도 통과한다(현재 동작 유지 확인용)"
  - "음수나 0원 줄은 별도로 확인하지 않음"
  - "반품 전표의 줄별 할인은 기존 returnedDiscount(반올림)를 그대로 둠"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(사소)을 반영해 할인 줄 부가세 테스트를 추가했다(커밋 498a3b4). `npm test` 51건 통과, 완료조건 7개 모두 통과, 테스트 파일 변경은 추가만 있어 약화 아님.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없음
새 지식: docs/knowledge/invoice/issued-totals-not-recalculated.md — 맞는 기존 항목이 없음
새 지식: docs/knowledge/invoice/format-output-frozen.md — 맞는 기존 항목이 없음
새 지식: docs/knowledge/invoice/vat-test-amounts.md — 맞는 기존 항목이 없음
## 다음 task가 알아야 할 것
- `src/invoice/vat.js`의 `computeVat`이 부가세 계산 한 곳이다.
- 검증 산출물은 `verification.md`, PR 초안은 `pr.md`.
- 브랜치 relay/w-20261004-001은 커밋 후 깨끗한 상태다.
