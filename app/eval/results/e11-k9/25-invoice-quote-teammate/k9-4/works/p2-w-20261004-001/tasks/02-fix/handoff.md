---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "total.js(청구서) 호출 오류도 같이 고친다"
    why: "같은 원인으로 npm test 19개가 실패해 완료조건과 비목표가 부딪혔고 사람이 함께 수정을 선택함"
    by: human
assumptions:
  - "보고된 56,280원은 옛 계산(할인 전 기준 부가세)의 값이라고 추정하며 확인하지 못함. 규칙 값은 56,278원"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "total.js는 intent 비목표(청구서 계산 불변)에 걸치지만 호출 오류만 고쳤고, 발행된 청구서는 저장된 totals를 써서 영향 없음"
  - "새 테스트를 추가하지 않고 기존 quote 테스트(Q-0457 동일 품목)를 재현 테스트로 썼음"
recommended_next: null
knowledge_candidates:
  - "vat.js의 sumLineVat은 과세 줄 net 숫자 배열을 받는다. 줄 객체를 넘기면 TypeError이므로 호출부는 rows.filter(r => r.taxable).map(r => r.net)를 넘긴다"
---
## 요약
견적서와 청구서의 부가세 합산 호출이 바뀐 sumLineVat 시그니처를 따르지 않아 TypeError가 나던 것을 고쳤다. Q-0457은 부가세 3,587원, 합계 56,278원이고 npm test 52개가 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: src/invoice/quote.js:39, src/invoice/total.js:26
- 원인 커밋: 3cccc30이 vat.js 시그니처만 바꾸고 credit-note만 맞춤
- 서식(src/format)과 quoteValidUntil은 손대지 않음
