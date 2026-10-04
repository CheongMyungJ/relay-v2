---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "Q-0457 기대 합계는 56,278원으로 한다"
    why: "사람이 경리 계산값이라고 답함"
    by: human
assumptions:
  - "견적서도 청구서와 같은 줄별 원 단위 버림 규칙을 따른다고 가정함 (경리 기대값과 맞아 보임)"
rejected: []
open_questions:
  - "견적서(quoteTotals)에 줄별 버림 규칙을 적용하는 것이 정식 규칙인가? (사람이 모름이라 답함)"
intent_deviation: null
risks:
  - "요청은 56,280원이라 하나 현재 quote.js는 이미 percentOfFloor를 쓰는 것으로 보임. 팀 지식은 견적서가 Math.round라고 하나 지금 코드와 다름. 원인이 다른 곳(할인 계산 등)일 수 있음"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 견적서(quoteTotals)에 줄별 버림 규칙을 적용하는지 — 사람도 모름, 이번 Work는 경리 계산값 56,278원에 맞춤 (사람)"
  - "Q-0457 경리 계산 합계는 56,278원 (사람)"
---
## 요약
견적서 Q-0457 합계를 경리 계산값 56,278원에 맞추는 버그 수정 의도 초안을 썼다. 견적 번호 형식과 유효 기간 계산은 건드리지 않는다.
## 다음 task가 알아야 할 것
- 코드: `src/invoice/quote.js` `quoteTotals`, 데이터: `examples/Q-0457.json`, 테스트: `test/quote.test.js` (`npm test`)
- 참고 지식: `docs/knowledge/billing/vat-rounding.md`
- 가설(원인 아님): quote.js는 이미 `percentOfFloor`를 쓰므로 2원 차이는 할인 계산(`lineDiscount`의 15% 할인 반올림 등)에서 올 수 있음. 확인 안 됨.
