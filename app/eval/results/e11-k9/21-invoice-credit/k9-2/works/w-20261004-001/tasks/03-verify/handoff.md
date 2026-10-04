---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)을 반영하지 않음"
    why: "사람이 반영하지 않음을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표 src/invoice/credit-note.js:90은 합계 기준 Math.round라 같은 불일치가 생길 수 있음(비목표)"
  - "이미 발행된 청구서는 저장된 totals를 쓰므로 기존 값은 바뀌지 않음"
  - "순 금액이 음수인 줄의 버림 방향은 테스트로 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이었고 사람이 반영하지 않기로 했다. 완료조건 5개 모두 최종 코드에서 직접 실행해 통과했다(INV-2031 합계 29,079원, npm test 51 pass). 바뀐 테스트 파일은 추가만 있어 약화 아님.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭(docs/knowledge가 비어 있었음). credit-note.js:90을 '아직 규칙을 따르지 않는 곳'에 적음.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` computeTotals의 vat
- 반품 전표 `src/invoice/credit-note.js:90`은 아직 합계 기준 반올림
