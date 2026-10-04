---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 부가세를 과세 줄마다 공급가액 × 세율을 `Math.floor`한 값의 합으로 계산한다"
    why: "intent와 팀 지식 docs/knowledge/billing/vat-calculation.md. 사람이 회계팀 규칙으로 확인"
    by: ai
assumptions:
  - "줄별 할인 반올림(`returnedDiscount`)은 그대로 둬도 회계팀 값과 맞는다. CN-0112 합계 19,180원으로 확인"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "청구서 쪽 `src/invoice/total.js`는 이 브랜치에서 아직 `Math.round`다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 비목표라 건드리지 않음"
  - "보조 테스트 일부는 수정 전에도 통과한다. 수정을 가르는 테스트는 CN-0112 하나"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/billing/vat-calculation.md — 반품 전표(`creditTotals`)의 부가세도 청구서와 같이 돌려받는 줄마다 할인 후 금액에 원 단위 버림으로 계산해 합산한다. 미정이던 항목이 정해졌고 구현됨 (사람, 회계팀 규칙)"
  - "CN-0112(INV-2047의 반품)의 회계팀 기준 환불 합계는 19,180원, 부가세 1,742원 (사람)"
---
## 요약
`creditTotals`가 부가세를 합계 기준으로 반올림해 CN-0112가 19,182원이 나왔다. 줄마다 버림 후 합산으로 고쳐 19,180원이 된다. 재현 테스트가 수정 전 실패, 수정 후 통과했고 `npm test` 48개가 통과했다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`의 `vat` 계산.
- 테스트: `test/credit-note.test.js` 끝의 테스트 2개. 실행은 `npm test`.
- 청구서 `computeTotals`(`src/invoice/total.js`)는 아직 `Math.round`. 이번 범위 밖.
