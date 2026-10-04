---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서와 크레딧노트의 부가세 계산은 바꾸지 않는다"
    why: "intent 비목표: 요청에 적힌 것 외의 문서 계산은 바꾸지 않음"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "quote.js와 credit-note.js는 아직 반올림 방식이라 청구서와 부가세가 다를 수 있음(비목표라 유지)"
recommended_next: null
knowledge_candidates:
  - "견적서(src/invoice/quote.js)와 크레딧노트(src/invoice/credit-note.js)도 부가세를 따로 계산한다. 청구서 규칙을 바꿀 때 같이 확인할 곳이다."
---
## 요약
부가세를 과세 줄마다 할인 후 금액 기준 원 단위 버림으로 계산해 합산하도록 고쳤다. INV-2031은 29,082원에서 29,079원이 되었다. 테스트 2개를 추가했고 `npm test`는 50건 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` computeTotals의 vat 줄
- 재현: `node src/cli.js examples/INV-2031.json --totals`
- 발행분은 `src/invoice/invoice.js:41`에서 저장 합계를 쓴다(변경 없음)
- `src/format/` 변경 없음
