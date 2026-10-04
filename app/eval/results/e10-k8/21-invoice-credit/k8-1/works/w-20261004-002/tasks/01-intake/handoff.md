---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 팀 지식의 줄별 버림 규칙을 따르는 것으로 목표를 잡았다"
    why: "팀 지식(사람이 정한 규칙)이 반품 전표(creditTotals)에도 같은 규칙을 쓰라고 명시함"
    by: ai
assumptions:
  - "회계팀 계산은 팀 지식의 줄별 버림 규칙과 같다고 가정했다. 요청에 기대 금액이 없어 확인하지 못함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: `src/invoice/total.js`의 `lineVat`은 이 브랜치에 아직 없을 수 있다"
  - "회계팀의 정확한 기대 금액을 모른다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 부가세 규칙과 저장 금액 불변, format 불변은 팀 지식에서 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- 관련 코드: `src/invoice/credit-note.js`의 `creditTotals`, `returnedDiscount`. 재현 입력: `examples/CN-0112.json`, `examples/INV-2047.json`.
- 테스트 명령: `npm test` (`node --test`, `test/` 디렉터리).
- 참고 팀 지식: docs/knowledge/accounting/vat-per-line-floor.md, docs/knowledge/invoice/issued-totals-are-stored.md (둘 다 기준 브랜치에 아직 없음).
