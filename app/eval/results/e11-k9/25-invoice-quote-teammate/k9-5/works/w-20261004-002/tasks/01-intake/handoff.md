---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "앞 Work의 팀 지식에 기대지 않고, 사람이 알려 준 회계 규정을 제약과 원하는 결과로 정리했다"
    why: "사람이 팀 지식은 이 브랜치에 없으니 이 요청 기준으로 정리하라고 함"
    by: human
  - what: "CN-0112 기대 환불 합계를 19,180원으로 둔다"
    why: "사람이 회계팀 계산값으로 알려 줌"
    by: human
  - what: "returnedDiscount의 금액 할인 수량 비율 분할은 바꾸지 않는다"
    why: "사람: 회계팀과 맞춘 방식"
    by: human
  - what: "청구서·견적은 이번 대상에서 뺀다"
    why: "사람이 범위로 지정"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "청구서·견적에 같은 부가세 문제가 있을 수 있으나 사람이 이번 범위에서 뺌"
recommended_next: null
knowledge_candidates:
  - "회계 규정: 부가세는 품목 줄마다 원 단위 버림, 그 합이 부가세, 합계에서 다시 반올림하지 않는다. 반품 전표도 돌려받는 품목 줄마다 계산한다. 할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다 (사람)"
  - "금액 할인 줄을 일부만 반품할 때 할인을 수량 비율로 나누는 방식은 회계팀과 맞춘 것이다 (사람)"
  - "이미 발행된 청구서와 이미 만든 반품 전표는 다시 계산하지 않고 저장된 금액을 그대로 쓴다 (사람)"
  - "src/format/ 출력 형식은 바뀌면 안 된다 (사람)"
  - "아직 규칙을 따르지 않음: 청구서·견적 계산 — 부가세 방식 미확인, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
반품 전표 환불 부가세를 회계 규정(줄마다 원 단위 버림 합)에 맞추는 버그 수정의 의도를 고쳤다. 기대값은 CN-0112 환불 합계 19,180원이다.
## 다음 task가 알아야 할 것
- 위치: `src/invoice/credit-note.js`의 `creditTotals`. 지금 코드는 부가세를 `Math.round(taxable * VAT_RATE_PERCENT / 100)`로 한 번에 계산한다. 원인 확정이 아니라 참고용 가설이다.
- 가설 검산: CN-0112 줄별 공급가 9,236 / 6,127 / 2,075, 줄별 버림 부가세 합 1,742 → 합계 19,180원. 현재 부가세는 1,744다.
- `returnedDiscount`(할인 분할)는 유지한다.
- 테스트: `npm test`(`node --test`), `test/credit-note.test.js`.
