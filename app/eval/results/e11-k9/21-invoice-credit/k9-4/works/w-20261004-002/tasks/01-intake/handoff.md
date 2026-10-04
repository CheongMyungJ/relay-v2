---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 계산은 팀 지식의 품목별 버림 합산 규칙을 따른다"
    why: "팀 지식 vat-per-line-floor.md가 반품 전표(creditTotals)에도 적용된다고 명시함"
    by: ai
assumptions:
  - "회계팀 계산 기준은 팀 지식의 품목별 버림 합산이라고 가정함. 요청에 회계팀 기대값은 없음"
  - "청구서(computeTotals) 쪽 수정은 앞 Work 몫이라 이번 범위에서 뺌"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 lineVat 등을 고쳤을 수 있음, 머지 대기. 이 브랜치에는 lineVat이 아직 없음"
  - "원인은 확인하지 않음. 부가세 외에 줄별 할인 반올림 등도 어긋남 원인일 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 intent 초안을 썼다. 부가세는 팀 규칙(품목별 버림 합산)을 제약에 옮겼다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js`의 `creditTotals`: 부가세를 `Math.round(taxable * 10 / 100)`로 합계 기준 반올림함(참고용 관찰, 원인 확정 아님).
- `returnedDiscount`: 금액 할인 수량 비례 분할에 `Math.round` 사용. 어긋남 후보로 fix에서 확인할 것.
- 참고 지식: docs/knowledge/invoice/vat-per-line-floor.md (기준 브랜치에는 아직 없음)
- 테스트: `npm test` (`node --test`), 관련 파일 test/credit-note.test.js
- 재현 입력: examples/CN-0112.json, examples/INV-2047.json (현재 환불 합계 19,182원)
