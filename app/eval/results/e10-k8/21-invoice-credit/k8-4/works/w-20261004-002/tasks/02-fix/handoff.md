---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄별 floorPercentOf 버림 합으로 계산"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md 규칙"
    by: ai
  - what: "floorPercentOf를 src/money.js에 직접 추가"
    why: "이 브랜치에 없어서 필요함. 앞 Work에서 같은 이름으로 추가될 수 있음"
    by: ai
assumptions:
  - "회계팀의 CN-0112 기대값은 규칙대로 계산한 19,180원이라고 가정함"
rejected:
  - "returnedDiscount 반올림(322.5→323)이 원인: 비목표이며 부가세 규칙만 고치면 해결됨"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: floorPercentOf가 src/money.js에 양쪽에서 추가되면 머지 충돌 가능"
  - "청구서 total.js:26은 비목표라 그대로 Math.round. 반품 전표와 청구서 계산이 머지 전까지 다름"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세를 과세 줄별 버림 합으로 계산하게 고쳤다. CN-0112 환불 합계는 19,182원에서 19,180원(부가세 1,742)이 되었다. 테스트 3개를 추가했고 `npm test`는 49개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals` vat 줄, `src/money.js` `floorPercentOf` 신규
- 재현: INV-2047 + CN-0112 → 수정 전 vat 1744 / total 19182, 수정 후 1742 / 19180
- 테스트: `test/credit-note.test.js` 끝 3개
- `floorPercentOf`는 앞 Work 머지 시 중복·충돌 확인 필요
