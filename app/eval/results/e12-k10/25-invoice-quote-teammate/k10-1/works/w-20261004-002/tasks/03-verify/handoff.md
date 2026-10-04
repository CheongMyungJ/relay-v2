---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 권장 1번(vatOfLines 단위 테스트)만 반영, 사소 2번은 반영하지 않음"
    why: "사람이 '차단·권장만 반영'을 선택"
    by: human
assumptions: []
rejected:
  - "지적 2(동적 import를 상단 import로): 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 vatOfLines를 이미 만들었을 수 있음, 머지 대기. 머지 때 src/money.js 충돌 가능"
  - "청구서(total.js)와 견적(quote.js)은 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 범위를 넓히지 않음"
  - "returnedDiscount의 Math.round는 그대로 둠"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰에서 권장 1건과 사소 1건이 나왔고, 사람이 권장만 골라 `vatOfLines` 단위 테스트를 추가했다(커밋 f5f662c). 완료조건 6개 모두 통과, `npm test` 51개 통과. 바뀐 테스트 파일은 모두 추가만 있어 약화 아님.
남긴 지식: 없음 (이 Work는 기존 팀 지식 vat-per-line-floor.md의 규칙을 반품 전표에 그대로 적용했고, 새 규칙이나 어긋나는 사람 말이 없으며 그 항목의 `아직 규칙을 따르지 않는 곳`도 없다)
## 다음 task가 알아야 할 것
- `src/money.js` 끝의 `vatOfLines`, `src/invoice/credit-note.js`의 `creditTotals`
- 테스트: `test/credit-note.test.js` 끝 2개, `test/money.test.js` 끝 1개. 명령 `npm test`
- CN-0112/INV-2047: 부가세 1,742원, 환불 합계 19,180원
