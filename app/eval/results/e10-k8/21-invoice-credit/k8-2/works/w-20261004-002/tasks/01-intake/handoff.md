---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 팀 지식의 줄별 버림 합 규칙을 기대 동작으로 삼는다"
    why: "팀 지식 vat-per-line-floor.md가 청구서와 반품 전표 모두에 같은 규칙이라고 적고 있어 사람에게 다시 묻지 않음"
    by: ai
assumptions:
  - "회계팀이 말한 몇 원 차이는 팀 지식의 부가세 규칙(회계팀 방식)과 같은 기준에서 나온 것이라고 가정함. 회계팀의 CN-0112 기대 금액은 요청에 없음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목은 앞 Work(w-20261004-001)에서 왔고 머지 대기라 이 브랜치에는 src/invoice/vat.js(computeVat)가 아직 없다. 앞 Work가 이미 고쳤을 수 있음, 머지 대기"
  - "회계팀의 CN-0112 기대 금액을 모른다. 환불 합계 19,182원이 어긋나는 원인이 부가세 하나인지는 fix에서 확인해야 한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 CN-0112의 환불 금액이 회계팀 계산과 어긋나는 버그의 intent 초안을 썼다. 팀 지식의 규칙 세 개(출력 형식 고정, 발행 합계 재계산 금지, 부가세 줄별 버림)를 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- 관련 코드: `src/invoice/credit-note.js`의 `creditTotals`, `returnedDiscount`. 테스트는 `test/credit-note.test.js`, 실행은 `npm test`(`node --test`).
- 이 브랜치에는 `src/invoice/vat.js`와 `docs/knowledge/`가 없다(앞 Work 머지 대기). computeVat이 없으면 같은 규칙으로 직접 만들어야 하는지 확인한다.
- 참고 팀 지식: `docs/knowledge/invoice/vat-per-line-floor.md`, `docs/knowledge/invoice/vat-test-amounts.md`(10원 단위 금액은 차이를 숨김, 테스트에 비10원 단위와 할인 줄 사용).
- 예시 데이터: `examples/CN-0112.json`(반품 OF-1342×8, OF-2150×3, OF-0415×5), `examples/INV-2047.json`.
