---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 합계는 경리가 계산한 56,278원으로 한다"
    why: "사람이 경리 금액을 알려 줌 (우리 쪽 56,280원보다 2원 적음)"
    by: human
  - what: "청구서와 대변전표 계산 결과는 바꾸지 않는 것을 제약과 비목표로 둔다"
    why: "vatOfLines를 세 문서가 함께 쓰고, 청구서 계산은 회계팀과 맞춘 것으로 알려져 있음"
    by: ai
assumptions:
  - "견적서 부가세 규정을 사람이 모르므로 경리 값 56,278원을 정답 기준으로 삼는다"
  - "경리가 계산한 56,278원은 Q-0457 전체 합계(공급가액+부가세)다"
rejected:
  - "팀 지식 vat-per-line-floor를 견적서의 확정 규정으로 쓰는 것: 사람이 견적서 규정은 모른다고 함"
open_questions: []
intent_deviation: null
risks:
  - "견적서 규정이 확정되지 않아, 56,278원에 맞추는 수정이 다른 견적에서는 틀릴 수 있음. fix에서 근거를 확인할 것"
  - "원인이 공용 함수 vatOfLines에 있으면 청구서와 대변전표에도 영향이 있어 수정 범위를 정해야 함"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 견적서 부가세 계산 규정 — 청구서를 회계팀과 맞춘 담당 동료가 휴가에서 돌아온 뒤 확인, 지금 코드는 vatOfLines(줄별 버림)를 씀 (사람)"
  - "경리 계산 기준 Q-0457 합계는 56,278원이고 코드 결과는 56,280원이었다 (사람)"
---
## 요약
경리 금액 56,278원을 기준으로 intent를 다시 잡았다. 견적서 부가세 규정은 미확정이라 팀 지식 vat-per-line-floor를 근거로 쓰지 않았고, 청구서와 대변전표 결과는 바꾸지 않도록 제약을 두었다.
## 다음 task가 알아야 할 것
- 코드: `src/invoice/quote.js`의 `quoteTotals`. 확인하지 않은 참고용 추정이다. 이미 `vatOfLines`를 쓰므로 할인(`lineDiscount`)이나 줄 금액(`lineGross`) 쪽도 볼 만하다.
- 데이터: `examples/Q-0457.json` (퍼센트 할인, 정액 할인, 면세 줄 포함).
- 테스트 명령: `npm test` (`node --test`).
- 참고 지식: `docs/knowledge/billing/vat-per-line-floor.md`(견적 확정 여부 미확인), `docs/knowledge/billing/issued-invoice-stored-totals.md`
