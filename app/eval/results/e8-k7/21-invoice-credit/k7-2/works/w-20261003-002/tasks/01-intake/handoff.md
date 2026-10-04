---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "청구서의 줄별 버림 부가세 규칙을 반품 전표에도 적용하는 것으로 intent를 쓴다"
    why: "팀 규칙 vat-floor-per-line이 '합계 반올림은 틀리다'고 하고, 요청도 환불이 회계팀 계산과 몇 원씩 안 맞는다는 내용이다"
    by: ai
assumptions:
  - "회계팀 계산은 청구서와 같은 줄별 버림 부가세 방식이라고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 3건이 기준 브랜치에 없어 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기. 청구서 계산 코드는 이 브랜치에서 아직 예전 방식일 수 있음"
  - "반품 줄 할인의 반올림(returnedDiscount)이 회계팀 방식과 같은지 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 몇 원씩 어긋나는 버그의 intent 초안을 썼다. 저장 금액 재계산 금지와 `src/format/` 불변을 비목표와 완료조건에 넣었다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: 반품 부가세 계산 위치. 코드만 훑었고 원인은 분석하지 않았다.
- 예: `examples/CN-0112.json`, `examples/INV-2047.json`. 현재 환불 합계는 19,182원이다(요청 기준).
- 테스트: `npm test`(`node --test`), `test/credit-note.test.js`
- 참고할 팀 지식: docs/knowledge/credit-note-vat-separate-copy.md (조사 사실, 기준 브랜치에 없음)
- 청구서 계산은 `src/invoice/total.js`
