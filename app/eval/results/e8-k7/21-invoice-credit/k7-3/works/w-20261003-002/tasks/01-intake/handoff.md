---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세도 청구서와 같은 회계팀 규칙(줄별 버림)을 따르게 한다"
    why: "팀 지식의 규칙이 말로 이번 경우를 덮고, 앞 Work에서 '반품 전표도 맞출지는 별도 요청'으로 남긴 건이 이번 요청이다"
    by: ai
assumptions:
  - "CN-0112의 회계팀 기대 환불 합계는 19,180원(요청에 값 없음, 규칙으로 계산)"
  - "할인 반올림(returnedDiscount)은 회계팀과 어긋나는 원인이 아니라고 보고 비목표로 둠"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "회계팀이 기대하는 정확한 금액을 확인하지 못함"
  - "앞 Work(w-20261003-001)에서 청구서 쪽을 고쳤을 수 있음, 머지 대기. docs/knowledge/는 이 브랜치에 아직 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 CN-0112의 환불 합계 불일치를 고치는 bugfix intent를 썼다. 규칙은 팀 지식(줄별 버림, 할인 후 부가세)을 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`가 부가세를 합계(taxable)에 곱해 `Math.round`로 계산한다. 원인 확정은 fix에서 한다.
- 현재 CN-0112: 과세 17,438원, 부가세 1,744원, 합계 19,182원. 줄별 버림이면 923+612+207=1,742원, 합계 19,180원.
- 참고 팀 지식(기준 브랜치에 아직 없음): `docs/knowledge/credit-note-vat-separate-copy.md`, `docs/knowledge/inv-2031-accounting-total.md`
- 테스트: `npm test`(node --test), `test/credit-note.test.js`
