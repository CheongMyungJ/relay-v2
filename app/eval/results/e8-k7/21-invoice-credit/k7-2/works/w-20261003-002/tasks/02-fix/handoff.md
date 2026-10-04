---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄마다 버림해서 합한다"
    why: "팀 지식 docs/knowledge/vat-floor-per-line.md와 intent 제약"
    by: ai
  - what: "청구서 계산(src/invoice/total.js)은 바꾸지 않는다"
    why: "intent 비목표. 청구서는 이 브랜치에서 아직 Math.round 방식이다"
    by: ai
assumptions:
  - "회계팀 계산은 줄별 버림 부가세 방식이라고 가정함. CN-0112의 회계팀 숫자는 직접 확인하지 못함"
rejected:
  - "반품 줄 할인 반올림(returnedDiscount)이 원인: 팀 규칙은 부가세만 다루고, 회계팀 방식을 확인할 수 없어 바꾸지 않음"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 청구서 total.js를 고쳤을 수 있음, 머지 대기. 이 브랜치의 청구서 부가세는 아직 합계 반올림이라 같은 청구서의 반품 부가세와 1~몇 원 어긋날 수 있음"
  - "반품 줄 할인의 Math.round(예: 322.5원이 323원)가 회계팀 방식과 같은지 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세(creditTotals)는 과세 줄마다 Math.floor해서 합한다. 청구서 규칙과 같게 맞춤. 예: CN-0112 부가세 1,742원, 합계 19,180원"
---
## 요약
`creditTotals`의 부가세를 합계 반올림에서 줄별 버림 합으로 바꿨다. CN-0112 환불 합계는 19,182원에서 19,180원이 된다. 재현 테스트는 수정 전 실패, 수정 후 통과했고 `npm test`는 48개 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: 줄별 floor로 수정.
- `test/credit-note.test.js`: CN-0112 테스트와 저장 totals 보존 테스트 추가.
- `creditNoteTotals`는 저장된 `totals`를 그대로 쓰고 바꾸지 않았다. `src/format/`과 `src/invoice/total.js`도 바꾸지 않았다.
- 확인 명령: `npm test`
- 확인 안 한 것: 반품 줄 할인 반올림이 회계팀 방식과 같은지.
