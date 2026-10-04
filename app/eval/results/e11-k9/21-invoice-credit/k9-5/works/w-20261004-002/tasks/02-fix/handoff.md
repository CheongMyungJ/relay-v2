---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄마다 버림 후 합산으로 바꾼다"
    why: "팀 지식 docs/knowledge/billing/vat-per-line-floor.md 규칙"
    by: ai
  - what: "할인 반올림(percentOf)은 그대로 둔다"
    why: "청구서와 같은 규칙이고 규칙이 바꾸라고 하지 않음"
    by: ai
assumptions:
  - "CN-0112의 회계팀 정답은 규칙으로 손계산한 1,742원/19,180원이라고 가정"
rejected:
  - "할인 반올림이 원인: 버림으로 바꿔도 줄 부가세가 같아 원인이 아니다"
open_questions: []
intent_deviation: null
risks:
  - "청구서 쪽(src/invoice/total.js)은 비목표라 합계 기준 Math.round 그대로임. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "지식 문서가 이 브랜치에 없어 규칙은 context.md 사본을 따랐다"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세도 줄마다 버림 후 합산으로 고침: src/invoice/credit-note.js creditTotals (CN-0112 = 1,742원/합계 19,180원)"
---
## 요약
`creditTotals`가 합계 기준 반올림으로 부가세를 구해 CN-0112가 1,744원(합계 19,182원)으로 나왔다. 줄마다 버림 후 합산으로 고쳐 1,742원(19,180원)이 된다. 테스트 추가, `npm test` 48개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`. 테스트: `test/credit-note.test.js` 끝의 2개.
- `creditNoteTotals`는 저장된 totals 우선이라 기존 전표 금액은 불변.
- `src/format/`과 청구서 계산은 건드리지 않음.
