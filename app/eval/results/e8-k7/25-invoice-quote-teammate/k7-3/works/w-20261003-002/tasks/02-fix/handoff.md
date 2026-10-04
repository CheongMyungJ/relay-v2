---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄별 원 단위 버림의 합으로 계산"
    why: "docs/knowledge/vat-per-line-floor.md (반품 전표 포함, CN-0112 vat 1,742)"
    by: ai
assumptions:
  - "vatOfRows가 이 브랜치에 없어 credit-note.js 안에 같은 규칙의 작은 함수를 둠"
rejected:
  - "returnedDiscount 반올림 변경: CN-0112에서 원인이 아니고 수정 후 지식 값과 일치함"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: 청구서·견적서의 같은 규칙 위반은 범위 밖이라 건드리지 않음. 머지 후 vatOfRows와 중복될 수 있음"
  - "저장된 totals가 있는 기존 반품 전표는 재계산하지 않아 값이 그대로임(의도대로)"
recommended_next: null
knowledge_candidates:
  - "반품 전표(src/invoice/credit-note.js creditTotals)도 부가세는 과세 줄별 버림의 합이다. CN-0112는 vat 1,742, 합계 19,180원(옛 방식 1,744/19,182)"
---
## 요약
반품 전표 부가세를 합계 반올림에서 줄별 버림의 합으로 고쳤다. CN-0112는 vat 1,742, 합계 19,180원. 재현 테스트를 추가했고 `npm test` 49개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `vatOfNet`, `creditTotals`.
- 테스트: `test/credit-note.test.js` 마지막 테스트(수정 전 vat 1744로 실패).
- `src/format/` 변경 없음, `creditNoteTotals` 저장값 우선 동작 유지.
