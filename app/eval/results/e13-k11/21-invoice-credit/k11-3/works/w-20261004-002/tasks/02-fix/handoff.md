---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 줄별 Math.floor 합으로 바꾸고, 할인 반올림(percentOf, 금액 할인 수량 분할)은 그대로 둔다"
    why: "docs/knowledge/invoice/vat-per-line-floor.md 규칙이 부가세를 덮고 할인 반올림은 규칙에 없음"
    by: ai
assumptions:
  - "회계팀 계산은 줄별 버림 규칙과 같다고 가정함 (기대 합계 19,180)"
rejected:
  - "금액 할인 수량 분할 반올림이 원인: CN-0112의 금액 할인 줄은 전량 반품이라 분할이 없음"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: creditTotals 줄별 버림. 머지 시 충돌 가능"
  - "청구서 계산 src/invoice/total.js는 이 브랜치에서 아직 Math.round 합산이나 비목표라 건드리지 않음"
  - "비율 할인 반올림(322.5→323)이 회계팀 방식과 다를 수 있으나 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세가 과세분 합에 한 번 반올림되어 어긋나던 것을 줄별 버림 합으로 고쳤다. CN-0112는 부가세 1,744→1,742, 합계 19,182→19,180. 재현 테스트를 추가했고 `npm test` 49개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js`의 `creditTotals`
- 테스트: `test/credit-note.test.js` 끝의 추가 3개 (기존 테스트는 그대로)
- 저장된 `totals`는 `creditNoteTotals`가 그대로 반환(테스트로 확인)
- `src/format/`, `total.js`는 건드리지 않음
