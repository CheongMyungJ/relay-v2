---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세 규칙은 팀 지식(줄별 버림 후 합산)을 제약으로 옮겼다"
    why: "팀 지식에 사람이 정한 규칙이 있어 다시 묻지 않음"
    by: ai
assumptions:
  - "회계팀 계산은 팀 지식의 줄별 버림 규칙과 같다고 보았다. 요청에 회계팀 기대 금액이 없다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 3건은 기준 브랜치에 아직 없다(앞 Work w-20261003-001, 머지 대기). 같은 규칙을 어기는 코드가 다른 곳에 있어도 앞 Work가 고쳤을 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액 불일치를 고치는 의도 초안을 썼다. 반품 전표도 청구서와 같은 부가세 규칙을 쓰는 것이 목표다.
## 다음 task가 알아야 할 것
- 참고용 가설(확인 안 됨): `src/invoice/credit-note.js`의 `creditTotals`가 부가세를 과세 합계에 한 번 곱해 반올림한다. CN-0112 계산으로는 17,438 x 10% = 1,744, 합계 19,182로 보고된 값과 같다.
- 줄별 버림이면 부가세는 923+612+207 = 1,742. 형광펜 5% 할인 반올림(322.5)에 따라 합계는 19,180 또는 19,181이다.
- 테스트: `npm test`(node --test), 관련 `test/credit-note.test.js`
- 참고 팀 지식: `docs/knowledge/credit-note-same-vat-rule.md`, `docs/knowledge/vat-per-line-floor.md`, `docs/knowledge/discount-before-vat-per-line.md`
