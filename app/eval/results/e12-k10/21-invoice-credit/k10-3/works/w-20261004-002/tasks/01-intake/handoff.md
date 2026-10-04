---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 돌려받는 줄마다 할인 후 금액에 원 단위 버림으로 계산해 합산한다"
    why: "사람이 회계팀 규칙으로 알려 줌. 청구서 규칙과 같다"
    by: human
  - what: "CN-0112의 기대 환불 합계는 19,180원"
    why: "사람이 회계팀 계산값으로 알려 줌 (현재 코드는 19,182원)"
    by: human
assumptions:
  - "비율 할인과 금액 할인의 줄별 반올림(`returnedDiscount`)은 지금 방식을 유지한다. 회계팀 규칙이 부가세 버림만 말함"
  - "면세 줄 제외와 영세율 0원은 지금 동작을 유지한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 만든 `docs/knowledge/billing/vat-calculation.md`가 기준 브랜치에 아직 없고, 그 Work가 고친 청구서 쪽 코드도 이 브랜치에 없을 수 있음(머지 대기)"
  - "부가세 금액을 사람이 몰라 합계 19,180원만 기준으로 삼음. 줄별 할인 반올림이 달라도 합계가 맞는지 fix에서 확인 필요"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/billing/vat-calculation.md — 반품 전표(`creditTotals`)의 부가세도 청구서와 같이 돌려받는 줄마다 할인 후 금액에 원 단위 버림으로 계산해 합산하며 합계에서 다시 반올림하지 않는다. 미정이던 항목이 정해졌다 (사람, 회계팀 규칙)"
  - "CN-0112(INV-2047의 반품)의 회계팀 기준 환불 합계는 19,180원 (사람)"
---
## 요약
반품 전표의 환불 금액이 회계팀 계산과 2원 어긋나는 버그의 의도 초안을 썼다. 반품 부가세 규칙은 사람이 알려 준 회계팀 규칙(줄마다 버림 후 합산)으로 정했다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: 부가세를 `Math.round(taxable * 세율 / 100)`로 합계 기준 반올림함. 청구서 규칙은 `docs/knowledge/billing/vat-calculation.md` 참고.
- 재현: `examples/CN-0112.json` + `examples/INV-2047.json`, 현재 19,182원, 기대 19,180원. 참고로 줄별 버림이면 박스테이프 923, 형광펜 612, 지우개 207로 부가세 합 1,742원이다.
- 테스트: `npm test`(`node --test`), 반품 테스트는 `test/credit-note.test.js`.
- 저장된 `totals`는 `creditNoteTotals`가 그대로 쓴다. `src/format/`은 건드리지 않는다.
