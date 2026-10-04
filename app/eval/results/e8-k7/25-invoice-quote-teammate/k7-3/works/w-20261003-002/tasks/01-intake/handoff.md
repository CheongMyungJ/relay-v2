---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 팀 지식의 줄별 원 단위 버림 합 규칙을 따른다고 제약에 옮김"
    why: "팀 지식 vat-per-line-floor.md의 적용 범위에 반품 전표가 들어 있어 다시 묻지 않음"
    by: ai
assumptions:
  - "회계팀이 말한 '몇 원' 차이는 팀 지식의 부가세 규칙(줄별 버림 합) 때문이라고 가정함. 확인은 fix에서 CN-0112 금액으로 한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: 청구서·견적서의 같은 규칙 위반(src/invoice/total.js 등)은 범위 밖으로 두었다"
  - "src/invoice/credit-note.js의 returnedDiscount(금액 할인의 수량 비율 반올림)도 금액에 영향을 줄 수 있어 fix에서 CN-0112 기준으로 확인 필요"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 저장된 금액 재계산 금지와 `src/format/` 불변을 비목표로, 부가세 줄별 버림 규칙을 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: 부가세를 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`로 계산함(줄별 아님). 이 브랜치에는 `vatOfRows`가 아직 없다(`src/invoice/total.js`는 `computeTotals`만 있음).
- 참고 지식: `docs/knowledge/vat-per-line-floor.md`, `docs/knowledge/no-recalc-issued-and-format.md`(둘 다 기준 브랜치에 아직 없음).
- 테스트: `npm test`(`node --test`), 기존 `test/credit-note.test.js`.
- 예시 입력: `examples/CN-0112.json`, `examples/INV-2047.json`(현재 환불 합계 19,182원).
