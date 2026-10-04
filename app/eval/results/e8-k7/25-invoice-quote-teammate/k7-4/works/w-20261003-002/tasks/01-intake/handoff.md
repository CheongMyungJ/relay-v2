---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "CN-0112 기대 환불 합계를 19,180원으로 적는다"
    why: "팀 지식 vat-per-line-floor.md가 CN-0112 합계를 19,180원으로 명시함"
    by: ai
assumptions:
  - "기대 금액 19,180원은 팀 지식 문서 기준이며 코드로 직접 계산해 확인하지 않음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: 청구서·견적서의 같은 규칙 위반은 범위 밖이라 건드리지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 합계가 회계팀 계산과 몇 원 어긋나는 버그의 의도 초안을 썼다. 기대값과 부가세 규칙은 팀 지식을 따랐다.
## 다음 task가 알아야 할 것
- 팀 지식 참고: `docs/knowledge/vat-per-line-floor.md` (기준 브랜치에는 아직 없음, 앞 Work w-20261003-001)
- 재현 입력: `examples/CN-0112.json`, `examples/INV-2047.json`; 코드: `src/invoice/credit-note.js` (`creditTotals`, `returnedDiscount`)
- 테스트: `npm test`(`node --test`), 관련 `test/credit-note.test.js`
