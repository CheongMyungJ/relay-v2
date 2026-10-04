---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표의 부가세도 팀 지식의 줄별 원 단위 버림 규칙을 따르는 것을 기대 동작으로 삼는다"
    why: "팀 지식 vat-per-line-floor.md가 반품 전표(creditTotals)도 같은 규칙이라고 적고 있어 사람에게 다시 묻지 않음"
    by: ai
assumptions:
  - "이번 요청의 불일치는 부가세 계산 방식 차이로 본다 (확인 안 됨, fix에서 확인)"
  - "줄 할인의 반올림(returnedDiscount)은 규칙 밖이라 이번 범위에 넣지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식의 `lineVat`는 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 이 브랜치의 src/invoice/total.js에는 lineVat가 아직 없다"
  - "회계팀이 기대하는 정확한 CN-0112 금액을 받지 못했다. 규칙대로 계산한 값으로 비교한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
bugfix 의도 초안을 썼다. 반품 전표 CN-0112의 환불 금액이 회계팀 계산과 다른 문제를 고치되, 저장된 금액 재계산 금지와 `src/format/` 출력 유지를 비목표로 못박았다.
## 다음 task가 알아야 할 것
- 참고 팀 지식: `docs/knowledge/billing/vat-per-line-floor.md` (이 브랜치에는 아직 없음, 앞 Work 머지 대기)
- 위치: `src/invoice/credit-note.js`의 `creditTotals`(vat는 합계 `taxable`에 `Math.round`), `returnedDiscount`
- 내 가설(참고용, 확인 안 됨): CN-0112를 손으로 계산하면 줄별 버림 부가세 합 1,742원, 합계 19,180원으로 현재 19,182원과 2원 차이가 난다
- 테스트: `npm test`(node --test), `test/credit-note.test.js`
