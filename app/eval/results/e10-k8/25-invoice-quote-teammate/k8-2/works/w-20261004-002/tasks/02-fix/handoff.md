---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "`lineVatSum`을 `src/invoice/total.js`에 새로 만들고 반품 전표에만 적용했다"
    why: "팀 지식 vat-per-line-floor.md는 도우미 하나를 쓰라고 하나 기준 브랜치에 없다. 청구서·견적은 비목표라 건드리지 않음"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 `lineVatSum`을 이미 고쳤을 수 있음, 머지 대기: 머지 때 total.js에서 충돌 가능"
  - "`computeTotals`(청구서)는 아직 한 번 반올림이라 반품 전표와 규칙이 다르다(비목표라 유지)"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세를 과세 줄마다 할인 후 금액에 세율을 곱해 버림한 합으로 바꿨다. CN-0112 환불 합계가 19,182원에서 19,180원이 됐고 회귀 테스트를 추가했다. `npm test` 49건 통과.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVatSum` 신규, `src/invoice/credit-note.js` `creditTotals`에서 사용
- 회귀 테스트: `test/credit-note.test.js` 마지막 테스트
- `src/format/` 변경 없음, 저장된 `totals`는 `creditNoteTotals`가 그대로 반환
