---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세도 과세 줄별 원 단위 버림 합산 규칙을 따른다"
    why: "팀 지식 vat-floor-per-line(규칙)이 부가세를 새로 계산하는 모든 곳에 적용된다고 함. 앞 Work에서 반품 전표는 비목표였고 이번 요청이 그 새 일이다"
    by: ai
assumptions:
  - "회계팀 계산은 줄별 버림 규칙과 같다고 가정함. 요청에 회계팀 금액이 없음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 지식 문서가 아직 기준 브랜치에 없음, 머지 대기. 청구서 쪽 computeTotals 수정도 이 브랜치에 없을 수 있음"
  - "돌려받는 줄의 할인 반올림(returnedDiscount)이 회계팀 계산과 다른지는 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표의 환불 부가세를 팀 규칙(줄별 원 단위 버림 합산)에 맞추는 버그 수정 의도를 정리했다. 이미 저장된 금액과 `src/format/`은 건드리지 않는다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js`의 `creditTotals`가 부가세를 과세분 합계에 `Math.round`로 한 번 계산한다. 원인 확정은 fix에서 한다.
- 재현 입력: `examples/CN-0112.json`, `examples/INV-2047.json`. 테스트는 `npm test`(node --test), 관련 `test/credit-note.test.js`.
- 참고 지식: docs/knowledge/vat-floor-per-line.md, docs/knowledge/vat-code-locations.md
- 할인 반올림은 `percentOf`(src/money.js)를 쓴다. 부가세 문제로 바꾸지 않는다.
