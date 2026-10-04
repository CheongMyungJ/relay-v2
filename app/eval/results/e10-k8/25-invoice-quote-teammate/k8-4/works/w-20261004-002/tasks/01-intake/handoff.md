---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세에 팀 지식의 줄별 버림 규칙을 적용하는 것을 제약과 완료조건으로 옮김"
    why: "팀 지식 vat-per-line-floor.md의 규칙이 반품 전표를 '아직 따르지 않는 곳'으로 적고 있어 이번 요청이 그 대상임"
    by: ai
assumptions:
  - "회계팀 기준 금액은 줄별 버림 규칙으로 계산한 값이라고 가정함 (요청에 기대 금액이 없음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 팀 지식 파일은 기준 브랜치에 아직 없고 docs/knowledge/가 이 브랜치에 없음"
  - "회계팀 기준 금액을 확인하지 못함. fix에서 규칙으로 계산한 값과 회계팀 값이 다르면 사람에게 확인 필요"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액 불일치 버그의 intent 초안을 썼다. 부가세를 줄별 원 단위 버림으로 계산한다는 팀 지식 규칙을 제약과 완료조건에 반영했다.
## 다음 task가 알아야 할 것
- 요청 예: CN-0112 / INV-2047, 현재 환불 합계 19,182원 (`examples/CN-0112.json`, `examples/INV-2047.json`)
- 코드: `src/invoice/credit-note.js`의 `creditTotals`, `returnedDiscount`. 테스트는 `npm test` (`test/credit-note.test.js`)
- 참고 팀 지식: `docs/knowledge/invoice/vat-per-line-floor.md` (이 브랜치에는 없음, 컨텍스트에만 있음)
- 원인은 조사하지 않았다. 가설 없음.
