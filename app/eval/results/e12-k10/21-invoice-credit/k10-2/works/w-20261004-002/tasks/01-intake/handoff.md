---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 팀 지식의 회계팀 규칙(줄별 할인 후 금액에 Math.floor, 합산)을 따른다"
    why: "규칙이 반품 전표에도 적용되는 말이고, 요청의 환불 금액 불일치와 같은 영역이다. 팀 지식이 credit-note.js를 아직 규칙을 따르지 않는 곳으로 적고 있다"
    by: ai
assumptions:
  - "회계팀 계산은 팀 지식의 부가세 규칙과 같은 방식이라고 가정했다. 회계팀이 CN-0112에 기대하는 정확한 금액은 요청에 없다"
  - "금액 할인 안분과 비율 할인의 원 단위 반올림은 규칙 밖이라 바꾸지 않는 것으로 가정했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "회계팀이 기대하는 CN-0112 환불 합계를 모른다. 규칙대로 계산한 값과 회계팀 값이 다르면 줄 할인 반올림 쪽 차이일 수 있다"
  - "앞 Work(w-20261004-001)에서 청구서 쪽 부가세 규칙을 고쳤을 수 있음, 머지 대기. 이 브랜치에는 아직 그 코드와 docs/knowledge가 없다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 intent 초안을 썼다. 부가세는 팀 지식의 회계팀 규칙(줄별 버림 후 합산)을 제약으로 옮겼다. 저장된 금액 재계산 금지와 `src/format/` 불변은 비목표와 완료조건에 넣었다.
## 다음 task가 알아야 할 것
- 요청 대상: `src/invoice/credit-note.js`의 `creditTotals`(vat 계산, 90줄 근처)와 `returnedDiscount`. 원인은 확인하지 않았다.
- 팀 지식 참고: `docs/knowledge/invoice/vat-per-line-floor.md` (이 브랜치에는 아직 없고 컨텍스트에만 있다)
- 입력 예: `examples/CN-0112.json`, `examples/INV-2047.json`. 테스트: `npm test`(`node --test`), `test/credit-note.test.js`
