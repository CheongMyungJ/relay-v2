---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "`vatOfLines(rows, percent, zeroRated)`를 src/money.js에 새로 만들고 반품 전표만 사용하게 함"
    why: "팀 지식 docs/knowledge/billing/vat-per-line-floor.md 규칙. 이 브랜치에 함수가 없었음. 청구서·견적은 비목표"
    by: ai
assumptions:
  - "앞 Work의 vatOfLines 시그니처를 알 수 없어 임의로 정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 vatOfLines를 이미 만들었을 수 있음, 머지 대기. 머지 때 money.js 충돌 가능"
  - "청구서(total.js)와 견적(quote.js)은 아직 반올림 방식(앞 Work에서 고쳤을 수 있음, 머지 대기). 범위를 넓히지 않음"
  - "돌려받는 줄 할인(returnedDiscount)의 Math.round는 건드리지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세를 줄별 원 단위 버림 합산으로 바꿨다. CN-0112는 19,182원에서 19,180원이 됐다. 재현 테스트를 추가했고 `npm test`는 50개 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/money.js` 끝의 `vatOfLines`, `src/invoice/credit-note.js`의 `creditTotals`
- 테스트: `test/credit-note.test.js` 끝 2개, 명령 `npm test`
- 저장된 totals를 쓰는 `creditNoteTotals`는 변경 없음
