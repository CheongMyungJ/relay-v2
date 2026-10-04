---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "회계 규정은 팀 지식(line-floor-vat)의 줄별 원 단위 버림 합산이라고 보고, 그 규정에 맞는 금액을 기대값으로 삼았다"
  - "비목표와 완료조건은 요청 문장에서 초안으로 정했고 사람에게 따로 묻지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 같은 부가세 규칙을 어기는 코드가 이번 요청 밖에서 보여도 범위를 넓히지 않는다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계 계산과 어긋나는 버그의 의도를 정리했다. 발행된 전표의 저장 금액과 `src/format/` 출력은 바꾸지 않는다.
## 다음 task가 알아야 할 것
- 테스트: `npm test`(node --test)
- 관련 코드: `src/invoice/credit-note.js`의 `creditTotals`. 팀 지식 `docs/knowledge/vat/line-floor-vat.md`, `docs/knowledge/vat/issued-invoice-stored-totals.md`(기준 브랜치에는 아직 없음)가 참고 항목이다.
- 예시: `examples/CN-0112.json`, `examples/INV-2047.json`. 현재 CN-0112 환불 합계는 19,182원.
