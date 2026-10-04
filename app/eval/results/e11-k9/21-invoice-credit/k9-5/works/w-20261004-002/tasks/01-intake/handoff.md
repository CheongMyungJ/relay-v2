---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 계산 기준을 팀 지식의 줄마다 버림 규칙으로 intent 제약에 옮긴다"
    why: "팀 지식 rule(source: human)이 이번 경우를 덮는다. 다시 묻지 않는다"
    by: ai
assumptions:
  - "요청의 '몇 원씩 안 맞음'은 부가세 계산 방식 때문이라고 보고 완료조건을 쓴 것이 아니라, 회계팀 기준과의 일치로만 썼다. 원인은 fix에서 확인한다"
  - "청구서(invoice) 쪽 계산은 범위 밖으로 두었다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목은 기준 브랜치에 아직 없고 앞 Work(w-20261004-001)의 머지를 기다린다. 앞 Work가 고친 코드와 겹칠 수 있다"
  - "CN-0112의 회계팀 기준 정답 금액은 요청에 없다. 규칙으로 손계산해야 한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
버그 수정 intent 초안을 썼다. 반품 전표 환불 금액을 회계팀 기준과 맞추고, 저장된 금액과 `src/format/`은 건드리지 않는 것이 범위다.
## 다음 task가 알아야 할 것
- 참고 지식: `docs/knowledge/billing/vat-per-line-floor.md` (기준 브랜치에는 없음, 앞 Work 머지 대기). 그 문서의 "아직 규칙을 따르지 않는 곳"에 `src/invoice/credit-note.js:90`이 적혀 있다. 지금 코드를 보고 확인할 것.
- `creditTotals`(`src/invoice/credit-note.js`)가 반품 전표 금액을 계산하고, `creditNoteTotals`는 저장된 `totals`가 있으면 그대로 쓴다.
- 입력: `examples/CN-0112.json`, `examples/INV-2047.json`. 테스트는 `npm test`(`node --test`), 관련 파일 `test/credit-note.test.js`.
- 할인 반올림(`returnedDiscount`)도 반품 금액에 영향을 줄 수 있으니 회계팀 기준과 같이 확인할 것.
