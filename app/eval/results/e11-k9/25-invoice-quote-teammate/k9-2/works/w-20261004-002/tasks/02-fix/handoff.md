---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄별 Math.floor 합으로 바꾼다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md의 규칙"
    by: ai
assumptions:
  - "회계팀 계산이 줄별 버림과 같다고 가정한다. 회계팀 내역은 보지 못했다"
rejected:
  - "할인 반올림이 원인: CN-0112에서 supply는 그대로이고 차이는 부가세 반올림에서만 난다"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 청구서 쪽을 고쳤을 수 있음, 머지 대기. 같은 줄별 버림 코드로 충돌할 수 있다"
  - "quote.js는 비목표라 그대로다"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세(src/invoice/credit-note.js creditTotals)도 과세 줄별 Math.floor 합으로 바꿈. CN-0112는 vat 1,742, 합계 19,180"
---
## 요약
`creditTotals`의 부가세를 과세 줄별 버림 합으로 고쳤다. CN-0112는 합계가 19,182원에서 19,180원이 된다. 재현 테스트를 추가했고 `npm test`는 51개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`의 `vat`
- 테스트: `test/credit-note.test.js` 끝의 3개. 수정 전에는 2개가 실패했다
- 과세 줄 판정은 `taxType === 'taxable'`이라 taxType이 없는 줄은 면세로 계산된다
- `creditNoteTotals`는 저장된 totals를 그대로 쓴다
