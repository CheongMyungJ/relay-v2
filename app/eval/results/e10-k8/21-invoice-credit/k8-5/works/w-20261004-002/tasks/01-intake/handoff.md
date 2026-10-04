---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 청구서와 같은 줄별 원 단위 버림 합산 규칙을 따르는 것으로 목표를 잡았다"
    why: "팀 지식 vat-per-line-floor.md가 creditTotals를 규칙을 아직 따르지 않는 곳으로 적고 있어 다시 묻지 않음"
    by: ai
  - what: "금액 할인의 수량 비율 나눔(returnedDiscount)은 그대로 두고 비목표로 한다"
    why: "사람이 회계팀과 맞춘 방식이라고 알려 줌"
    by: human
assumptions:
  - "회계팀이 기대하는 정확한 환불 금액은 요청에 없어, 회계팀 방식(줄별 버림)으로 계산한 값을 기대값으로 본다"
  - "이미 발행된 반품 전표는 소급 수정하지 않는다 (팀 지식 규칙)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 규칙을 남겼고 머지 대기라 docs/knowledge/ 파일이 이 브랜치에는 없다"
recommended_next: null
knowledge_candidates:
  - "반품 전표에서 금액 할인을 돌려받는 수량 비율로 나누는 방식(returnedDiscount, 원 단위 반올림)은 회계팀과 맞춘 방식이라 바꾸지 않는다 (사람)"
---
## 요약
CN-0112 환불 합계(19,182원)가 회계팀 계산과 몇 원씩 다른 버그의 의도 초안을 썼다. 목표는 반품 전표 부가세를 청구서와 같은 줄별 버림 방식으로 맞추는 것이다.
## 다음 task가 알아야 할 것
- 대상: `src/invoice/credit-note.js`의 `creditTotals`. `returnedDiscount`는 건드리지 않는다. 테스트는 `test/credit-note.test.js`, 실행은 `npm test`(`node --test`).
- 재현 입력: examples/CN-0112.json, examples/INV-2047.json (INV-2047 totals: vat 5,801, total 63,807).
- 참고 지식: docs/knowledge/invoice/vat-per-line-floor.md, docs/knowledge/invoice/issued-invoice-totals-and-format.md (기준 브랜치에는 아직 없음).
- 가설(확인 안 됨): `creditTotals`가 과세 합계에 `Math.round`를 쓴다.
