---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 원 청구서와 맞물려 보정하지 않고 새 규칙(줄별 버림)만 적용한다"
    why: "사람이 '보정 없이 새 규칙만'을 골랐다"
    by: human
  - what: "회계팀 기대 환불 합계는 CN-0112 기준 19,180원이다"
    why: "사람이 직접 알려 줌"
    by: human
  - what: "비목표: 저장된 전표 재계산 안 함, src/format/ 출력 변경 안 함"
    why: "요청 원문과 사람의 선택"
    by: human
assumptions:
  - "현재 브랜치의 creditTotals는 과세분 합계에 Math.round를 쓴다(credit-note.js). 팀 지식의 줄별 버림 규칙과 다르다. 앞 Work에서 고쳤다는 lineVat은 이 브랜치에 없을 수 있다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 팀 지식이 말하는 lineVat과 creditTotals 수정이 이 브랜치에 아직 없을 수 있다"
  - "19,180원이 줄별 버림 규칙으로 나오는지는 확인하지 않았다. fix에서 계산해 확인해야 한다"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 반품 전표 부가세와 원 청구서 부가세의 보정 여부 — 사람이 이번 Work에서는 보정 없이 새 규칙만 적용하기로 함, 지금 코드는 보정 없음 (사람)"
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 몇 원 어긋나는 버그의 의도를 정리했다. 기대값은 CN-0112 합계 19,180원이다. 보정 없이 새 규칙만 적용하고, 저장된 전표와 `src/format/`은 건드리지 않는다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: 부가세를 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`로 한 번에 계산한다. 팀 지식 `docs/knowledge/invoice/vat-rule.md`는 줄별 버림을 말한다. 이 브랜치에는 `lineVat`이 없을 수 있다. 원인은 fix에서 확인한다.
- `returnedDiscount`의 금액 할인 반올림(`Math.round`)도 금액 차이에 관여할 수 있다. 가설이며 확인하지 않았다.
- 테스트: `npm test`(node --test), `test/credit-note.test.js`.
- 예시: `examples/CN-0112.json`, `examples/INV-2047.json`.
