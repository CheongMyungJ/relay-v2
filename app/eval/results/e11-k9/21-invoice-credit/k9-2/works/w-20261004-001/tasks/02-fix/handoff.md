---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세를 과세 줄마다 Math.floor(할인 후 금액 × 세율 / 100)로 계산해 합산"
    why: "intent 원하는 결과와 t-01의 사람 결정"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표 src/invoice/credit-note.js:90은 여전히 합계 기준 Math.round라 같은 불일치가 생길 수 있음(비목표)"
  - "이미 발행된 청구서는 저장된 totals를 쓰므로 기존 값은 바뀌지 않음"
recommended_next: null
knowledge_candidates:
  - "아직 규칙을 따르지 않음: src/invoice/credit-note.js:90 — 합계 기준 Math.round, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
부가세를 줄별 버림 합으로 바꿨다. INV-2031 합계가 29,079원이 되었고 `npm test` 51개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` computeTotals의 vat 계산
- 테스트 5개 추가: `test/total.test.js`, 기존 테스트 변경 없음
- 수정 전 4건 실패 확인(영세율 테스트는 기존에도 통과)
