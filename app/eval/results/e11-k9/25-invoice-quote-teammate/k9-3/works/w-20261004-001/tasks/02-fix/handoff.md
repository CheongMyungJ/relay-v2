---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "줄별 부가세 계산을 `src/invoice/vat.js` 한 곳에 두고 청구서·견적서·반품 전표가 함께 쓴다"
    why: "세 곳이 같은 규칙을 쓰도록 하라는 완료조건. 중복 구현을 피함"
    by: ai
  - what: "발행된 INV-2047은 저장된 totals(5,801)를 그대로 둔다"
    why: "intent 비목표: 발행된 청구서는 다시 계산하지 않는다"
    by: ai
assumptions:
  - "할인 비율 계산(`percentOf`의 반올림)은 부가세가 아니라 할인 금액 계산이라 기존대로 둠"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "INV-2047을 줄별 버림으로 손계산하면 vat 5,798, 합계 63,804인데 저장값은 5,801/63,807이다. 발행분이라 의도된 불일치"
  - "기존 테스트는 바꾸지 않았다"
recommended_next: null
knowledge_candidates:
  - "회계팀 부가세 규칙: 줄마다 원 단위 버림으로 계산해 합산하고 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄별 적용 (사람)"
  - "부가세 계산은 `src/invoice/vat.js`의 `lineVat`/`sumLineVat`을 쓴다. 청구서, 견적서, 반품 전표가 공유한다"
---
## 요약
부가세를 줄별 원 단위 버림의 합으로 바꿨다. INV-2031은 이제 vat 2,641, 합계 29,079원이다. 견적서와 반품 전표도 같은 규칙이다. `npm test` 55개가 통과한다.
## 다음 task가 알아야 할 것
- 새 파일: `src/invoice/vat.js`, 테스트 `test/vat-per-line.test.js`(수정 전 4개 실패 확인)
- 손계산 일치: Q-0457 vat 3,587/합계 56,278, CN-0112 vat 1,742/합계 19,180, INV-2031 29,079
- INV-2047은 발행분이라 저장값 유지(줄별 계산값은 5,798)
- 기존 테스트 변경 없음, `src/format/` 변경 없음
