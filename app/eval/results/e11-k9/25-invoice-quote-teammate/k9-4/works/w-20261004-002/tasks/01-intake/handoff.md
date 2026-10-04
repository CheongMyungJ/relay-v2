---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 기준을 팀 지식의 과세 줄별 원 단위 내림 합산으로 둔다"
    why: "회계팀 방식이라는 팀 지식(vat-per-line-floor)이 반품 전표도 덮는다"
    by: ai
assumptions:
  - "회계팀이 기대하는 금액은 팀 지식의 부가세 규칙으로 계산한 값이다 (요청에 정답 금액 없음)"
  - "`src/invoice/vat.js`는 기준 브랜치에 아직 없을 수 있다 (앞 Work w-20261004-001 머지 대기)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 청구서/견적서 부가세 계산"
recommended_next: null
knowledge_candidates: []
---
## 요약
CN-0112 환불 금액이 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 저장된 합계 재사용과 `src/format/` 형식 유지를 비목표로 두었다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: 현재 부가세를 과세 합계에 한 번 `Math.round`로 계산한다. (내 가설, 확인 안 됨: 팀 지식의 줄별 내림 규칙과 다를 수 있음)
- `returnedDiscount`도 반올림을 쓴다. 할인 계산 경로도 확인할 것.
- 입력: `examples/CN-0112.json`, `examples/INV-2047.json`. 테스트: `npm test` (`node --test`).
- 참고 팀 지식: docs/knowledge/invoice/vat-per-line-floor.md, issued-invoice-totals-stored.md, format-output-unchanged.md
