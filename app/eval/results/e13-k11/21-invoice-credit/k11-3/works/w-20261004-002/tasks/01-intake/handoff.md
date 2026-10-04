---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 금액 계산을 청구서와 같은 규칙(줄별 할인 후 줄별 Math.floor 부가세 합)으로 맞추는 것을 기대 동작으로 삼는다"
    why: "팀 지식 vat-per-line-floor.md의 규칙이 이번 경우를 덮음. 사람에게 다시 묻지 않음"
    by: ai
assumptions:
  - "회계팀 계산은 팀 지식의 규칙(줄별 버림)과 같다고 가정함. CN-0112의 정확한 기대 금액은 요청에 없음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 그 Work가 creditTotals를 줄별 버림으로 바꿨다고 팀 지식에 적혀 있으나 이 브랜치의 credit-note.js는 아직 Math.round(과세분 합 x 세율)를 씀"
  - "금액 할인의 수량 비율 분할(returnedDiscount의 Math.round)도 어긋남의 원인일 수 있으나 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 몇 원 어긋나는 버그의 의도 초안을 썼다. 기준은 팀 지식의 줄별 버림 규칙이고, 발행분 재계산 금지와 src/format/ 불변을 비목표로 두었다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js`의 `creditTotals`, `returnedDiscount`: 이 브랜치에서 vat는 과세분 합에 `Math.round`. 원인은 fix에서 확인할 것
- 참고 지식: docs/knowledge/invoice/vat-per-line-floor.md, issued-invoice-no-recalc.md (기준 브랜치에는 아직 없음)
- 예제: `examples/CN-0112.json`, `examples/INV-2047.json`. 테스트는 `npm test`, 관련 파일 `test/credit-note.test.js`
