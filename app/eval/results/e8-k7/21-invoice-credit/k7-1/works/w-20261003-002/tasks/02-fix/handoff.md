---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄별 Math.floor 합으로 계산한다"
    why: "팀 지식 docs/knowledge/vat-floor-per-line.md (규칙)와 intent 원하는 결과"
    by: ai
assumptions:
  - "회계팀 계산은 줄별 버림 규칙과 같다고 가정함 (요청에 회계팀 금액 없음)"
rejected:
  - "할인 반올림(percentOf/returnedDiscount)이 원인: 비목표이며 부가세 규칙만 바꿔도 규칙 값이 나옴"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: 이 브랜치의 computeTotals(src/invoice/total.js)는 아직 Math.round (비목표라 건드리지 않음)"
  - "returnedDiscount의 금액 할인 Math.round가 회계팀 계산과 같은지 확인하지 않음"
  - "수정 전 검증 중 git stash push/pop을 한 번 썼음. 스택은 비어 있음"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세(src/invoice/credit-note.js creditTotals)도 과세 줄별 원 단위 버림 합산으로 계산한다. CN-0112/INV-2047은 부가세 1,742원, 합계 19,180원이다. 이미 저장된 totals는 바꾸지 않는다."
---
## 요약
`creditTotals`의 부가세를 줄별 버림 합으로 바꿨다. CN-0112 환불 합계는 19,182원에서 19,180원이 됐다. 재현 테스트를 추가했고 `npm test` 47개가 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js`의 `creditTotals` (부가세 줄별 `Math.floor`)
- 테스트: `test/credit-note.test.js` 마지막 테스트, 수정 전 실패(vat 1744), 수정 후 통과
- `creditNoteTotals`는 저장된 totals를 그대로 반환, 기존 테스트의 저장 금액 케이스가 이를 확인
- `computeTotals`와 할인 계산은 건드리지 않음
