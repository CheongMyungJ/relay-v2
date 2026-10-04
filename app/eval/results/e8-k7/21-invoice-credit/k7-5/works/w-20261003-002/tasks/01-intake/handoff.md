---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "회계팀 기대 금액 대신 팀 지식의 계산 규칙을 완료 기준으로 삼는다"
    why: "요청에 회계팀 금액이 없고, 부가세·할인 규칙이 팀 지식에 이미 있다"
    by: ai
assumptions:
  - "회계팀 계산은 팀 지식의 줄별 버림 부가세 규칙과 같다고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 규칙을 어기는 코드가 다른 곳에 있다면 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액 오차를 고치는 bugfix 의도 초안을 썼다. 팀 지식 규칙 네 개를 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- 테스트: `npm test` (node --test), 테스트는 `test/`에 있다.
- 관련 위치: `src/invoice/credit-note.js`의 `creditTotals`, `returnedDiscount`. 참고(가설, 확인 안 됨): `creditTotals`가 과세 합계에 `Math.round`로 부가세를 계산하고, 금액 할인은 수량 비율로 반올림한다.
- 참고 지식(기준 브랜치에는 아직 없음): `docs/knowledge/vat-per-line-floor.md`, `discount-before-vat-per-line.md`, `issued-invoice-keep-stored-totals.md`, `format-dir-output-unchanged.md`
- 예시: `examples/CN-0112.json`, `examples/INV-2047.json`
