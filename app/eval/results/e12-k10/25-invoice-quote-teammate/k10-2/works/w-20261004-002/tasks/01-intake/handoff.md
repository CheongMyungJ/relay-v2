---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 계산 규칙은 팀 지식(줄마다 원 미만 절사 후 합산)을 제약으로 따른다"
    why: "팀 지식 항목이 반품 전표를 명시적으로 포함하고 사람이 정한 규칙이라 다시 묻지 않음"
    by: ai
assumptions:
  - "CN-0112의 기대 합계 19,180원은 팀 지식 항목의 값이며 이번 요청의 19,182원과 2원 차이로 맞는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식은 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에 아직 없음. 그 Work가 total.js의 lineVat을 이미 만들었을 수 있어 이 브랜치에는 없을 수 있음, 머지 대기"
  - "docs/knowledge 디렉터리가 이 브랜치에 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 합계가 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 기대값은 팀 지식의 규칙(줄마다 절사)과 CN-0112 합계 19,180원이다.
## 다음 task가 알아야 할 것
- 참고 팀 지식: `docs/knowledge/invoice/vat-per-line-floor.md` (기준 브랜치에 없음, context.md에 내용 있음)
- 가설(참고용, 확인 안 됨): `src/invoice/credit-note.js`의 `creditTotals`가 과세분 합계에 `Math.round`로 부가세를 계산함. 규칙은 줄마다 절사.
- `src/invoice/total.js`에 `lineVat`이 있는지 fix에서 확인할 것.
- 테스트: `npm test` (node --test)
- 예제: `examples/CN-0112.json`, `examples/INV-2047.json`
