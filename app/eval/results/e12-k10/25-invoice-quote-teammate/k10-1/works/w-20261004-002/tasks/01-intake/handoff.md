---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 규정은 팀 지식(줄별 원 단위 버림 합산)을 제약으로 옮기고 사람에게 다시 묻지 않음"
    why: "팀 지식 vat-per-line-floor.md가 반품 전표(credit-note.js)를 명시적으로 포함함"
    by: ai
  - what: "청구서·견적 계산은 비목표로 둠"
    why: "요청이 반품 전표 환불 금액만 다룸"
    by: ai
assumptions:
  - "회계팀 계산과의 몇 원 차이는 부가세 계산 방식 차이에서 온다고 보고 완료조건을 규정 기준으로 씀(원인 확정 아님)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식의 `vatOfLines`(src/money.js)는 이 브랜치에 아직 없음. 앞 Work(w-20261004-001)에서 만들었을 수 있고 머지 대기 중"
  - "청구서(total.js:26)와 견적(quote.js:42)도 같은 규칙을 어기는 것으로 보이나 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 범위를 넓히지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 부가세는 팀 규정(줄별 버림 합산)을 제약으로 옮겼고, 저장된 금액 재계산 금지와 서식 모듈 불변을 비목표로 두었다.
## 다음 task가 알아야 할 것
- 관련 코드: `src/invoice/credit-note.js`의 `creditTotals`(부가세 계산부), 테스트 `test/credit-note.test.js`
- 재현 입력: `examples/CN-0112.json`, `examples/INV-2047.json` (현재 환불 합계 19,182원)
- 테스트 명령: `npm test` (`node --test`)
- 참고 팀 지식: docs/knowledge/billing/vat-per-line-floor.md, docs/knowledge/billing/issued-invoice-stored-totals.md (기준 브랜치에 아직 없음)
- 이 브랜치에 `vatOfLines`가 없으므로 선행 Work 머지 여부를 먼저 확인할 것
