---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 `creditTotals`도 줄별 원 단위 버림 합으로 같이 고친다"
    why: "같은 반올림 식이 복사돼 있어 범위 확대 여부를 물었고 사람이 같이 고치라고 답함"
    by: human
  - what: "줄별 부가세는 `lineVat`(Math.floor) 한 곳에 두고 청구서와 반품 전표가 함께 쓴다"
    why: "규칙을 한 곳에 둬 두 계산이 어긋나지 않게 함"
    by: ai
assumptions:
  - "반품 전표의 할인 안분(`returnedDiscount`)의 반올림은 규칙 밖이라 그대로 둠"
rejected:
  - "money.js percentOf / discount.js 반올림: 할인 없는 INV-2031에서도 재현되고 부가세에 쓰이지 않음"
open_questions: []
intent_deviation: null
risks:
  - "이미 저장된 반품 전표와 발행 청구서는 저장 합계를 그대로 써서 바뀌지 않는다. 발행 전 초안과 새 전표만 새 규칙을 따른다."
  - "`examples/INV-2031.json`은 taxType이 없어 normalizeLine을 거쳐야 과세로 계산된다"
recommended_next: null
knowledge_candidates:
  - "부가세 줄별 계산은 `src/invoice/total.js` `lineVat` 한 곳에 있고, 청구서(`computeTotals`)와 반품 전표(`creditTotals`)가 함께 쓴다"
---
## 요약
청구서 부가세를 줄별(할인 후, 과세 줄만) 원 단위 버림 합으로 바꿨다. INV-2031은 29,079원이다. 반품 전표도 사람 선택으로 같이 고쳤다. 테스트 4건을 추가했고 `npm test`는 50건 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVat`, `computeTotals`; `src/invoice/credit-note.js` `creditTotals`
- 기존 테스트는 바꾸지 않았고 모두 통과
- 재현: `node /tmp/repro.mjs` (INV-2031 정규화 후 계산)
- `src/format/`은 건드리지 않음
