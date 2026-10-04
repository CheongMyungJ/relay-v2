---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "`lineVat`을 `src/invoice/total.js`에 새로 추가하고 반품 전표만 사용하게 했다"
    why: "docs/knowledge/accounting/vat-per-line-floor.md: 규칙은 lineVat 한 곳에 둔다. 청구서 쪽 계산은 비목표라 바꾸지 않았다"
    by: ai
assumptions:
  - "회계팀 기대 금액은 줄별 버림 규칙 값(CN-0112 부가세 1,742원, 합계 19,180원)과 같다고 가정"
rejected:
  - "returnedDiscount 오류: 공급가액은 맞고 부가세 반올림만 어긋남"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 lineVat을 이미 고쳤을 수 있음, 머지 대기: 머지 때 `total.js`의 lineVat이 충돌할 수 있음"
  - "청구서 computeTotals는 아직 합계 반올림을 쓴다(비목표라 유지)"
  - "줄 할인 반올림 규칙(returnedDiscount)은 확인만 하고 바꾸지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세를 줄마다 버림한 값의 합으로 계산하도록 고쳤다. CN-0112는 부가세 1,744→1,742원, 합계 19,182→19,180원이다. 재현 테스트가 수정 전 실패, 수정 후 통과했고 `npm test`는 49개 모두 통과했다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js`: `lineVat` 추가. `src/invoice/credit-note.js` `creditTotals`가 사용.
- 테스트: `test/credit-note.test.js` 끝의 3개. 명령 `npm test`.
- `src/format/`과 `computeTotals`는 변경 없음. 저장된 totals는 `creditNoteTotals`가 그대로 반환.
