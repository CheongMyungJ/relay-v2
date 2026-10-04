---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 금액의 기준은 팀 지식의 회계 규칙(줄별 할인 후 부가세 원 단위 버림 합산)으로 한다"
    why: "요청에 회계팀 기대값이 없고, 팀 지식이 반품 전표에도 적용된다고 명시함"
    by: ai
assumptions:
  - "회계팀 계산은 팀 지식의 규칙과 같다고 가정함. CN-0112의 회계팀 기대 금액은 요청에 없음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 3건은 기준 브랜치에 아직 없음. 앞 Work(w-20261003-001)에서 청구서·견적을 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 팀 지식의 부가세 규칙 3건을 제약에 옮겼다.
## 다음 task가 알아야 할 것
- 대상: `src/invoice/credit-note.js`의 `creditTotals`. 코드는 읽기만 했고 원인은 분석하지 않았다.
- 입력: `examples/CN-0112.json`, `examples/INV-2047.json`. 현재 CN-0112 환불 합계는 19,182원(요청 기준).
- 테스트: `npm test` (`node --test`).
- 참고 지식: `docs/knowledge/vat-floor-per-line.md`, `docs/knowledge/discount-before-vat.md`, `docs/knowledge/issued-invoice-keeps-stored-totals.md`.
- 사람 요청: `src/format/` 출력 형식 불변, 저장된 금액은 재계산 금지.
