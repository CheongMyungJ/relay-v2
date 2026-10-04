---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 합계는 경리 계산 금액 56,278원으로 한다"
    why: "요청자가 경리 담당 계산값이라며 직접 알려 줌"
    by: human
  - what: "견적 부가세에 줄별 버림 규칙을 적용하는 방향으로 초안을 쓴다"
    why: "요청자가 규칙은 모른다고 답함. 줄별 버림으로 계산한 합계가 경리 금액 56,278원과 일치함"
    by: ai
assumptions:
  - "견적서도 청구서와 같은 줄별 버림 규칙을 쓴다 (팀 지식에는 미정으로 남아 있음)"
rejected: []
open_questions:
  - "견적서에 줄별 버림 부가세 규칙을 적용하는 것이 회계팀 규칙으로 확정인지: 요청자는 모르고 청구서를 맞춘 동료는 휴가 중이다. 경리 금액 56,278원과의 일치만 근거다"
intent_deviation: null
risks:
  - "요청의 '우리 합계 56,280원'이 현재 코드 결과(57,958원)와 다르다. 요청자가 본 값이 옛 코드/저장값일 수 있다"
  - "현재 `npm test`가 11건 실패한다 (intake 시점, 원인 미확인)"
recommended_next: null
knowledge_candidates:
  - "경리 계산 Q-0457 합계는 56,278원이다 (사람)"
  - "정하지 않음: 견적서 부가세에 줄별 버림 규칙을 적용하는지 — 요청자는 모름, 청구서를 회계팀과 맞춘 동료가 휴가 중, 지금 코드는 줄별 버림을 시도 중 (사람)"
---
## 요약
Q-0457 견적 합계가 경리 금액 56,278원과 맞도록 `quoteTotals`를 고치는 버그 수정 intent 초안을 썼다. 견적 번호 형식과 유효 기간 계산은 비목표다.
## 다음 task가 알아야 할 것
- 내 가설(참고용, 확인 안 됨): 현재 `src/invoice/quote.js`의 `quoteTotals`와 `src/invoice/total.js`의 `computeTotals`는 `lineVat(net, { taxable, zeroRated })`처럼 객체를 넘기는데, `lineVat(net, taxable)`은 불리언을 받는다. 객체는 늘 참이라 면세 줄에도 부가세가 붙는 것으로 보인다. `zeroRated`도 무시된다.
- 현재 Q-0457 결과: supply 52,691 / vat 5,267 / total 57,958. 줄별 버림 손계산 합계는 56,278.
- `npm test`는 55건 중 11건 실패 상태다 (`test/quote.test.js`, `test/total.test.js` 등 확인 필요).
- 참고 지식: `docs/knowledge/invoice/vat-per-line-floor.md`, `docs/knowledge/invoice/vat-rule.md`
