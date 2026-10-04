---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세에 팀 지식의 줄별 버림 규칙을 적용하는 것으로 의도를 잡음"
    why: "팀 지식에 청구서와 반품 전표 모두 같은 규칙이라고 적혀 있어 다시 묻지 않음"
    by: ai
assumptions:
  - "회계팀의 CN-0112 기대 금액은 줄별 버림 규칙으로 계산한 값이라고 가정함"
  - "청구서 계산(total.js)은 앞 Work에서 고치므로 이번 범위에서 제외함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: src/invoice/total.js:26의 Math.round 부가세, src/money.js의 floorPercentOf. 이 브랜치에는 floorPercentOf가 아직 없음"
  - "회계팀이 말한 정확한 기대 금액이 없어 규칙 기준으로 판단해야 함"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 부가세를 회계팀 규칙(과세 줄별 버림 합)에 맞추는 버그 수정 의도 초안을 썼다.
## 다음 task가 알아야 할 것
- 참고 팀 지식: `docs/knowledge/invoice/vat-per-line-floor.md` (기준 브랜치에는 아직 없음)
- 대상: `src/invoice/credit-note.js` `creditTotals`의 vat 줄(`Math.round(taxable * 10 / 100)`, 합계에 한 번 반올림)
- 예제: `examples/CN-0112.json`, `examples/INV-2047.json`. 현재 결과 합계 19,182원(재현은 fix에서)
- 참고(내 추정, 확인 안 됨): `returnedDiscount`의 금액 할인·비율 할인 반올림도 줄 금액에 영향을 줌. 비율 할인 322.5원 처리 확인 필요
- 테스트: `npm test` (node --test), 반품 전표 테스트는 `test/credit-note.test.js`
