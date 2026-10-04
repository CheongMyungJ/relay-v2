---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1번(사소, 보조 테스트가 수정 전에도 통과)을 반영하지 않음"
    why: "사람이 반영하지 않음을 선택. 저장 금액 유지 완료조건의 보호 장치로 의미가 있음"
    by: human
assumptions:
  - "회계팀의 CN-0112 기대 금액은 규정대로 계산한 19,180원이라고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "청구서 `computeTotals`는 합계 반올림 방식 그대로임(비목표). 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "`lineVat`는 앞 Work(w-20261004-001)에서 이미 추가했을 수 있음, 머지 대기. `src/invoice/total.js`가 충돌할 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건이고 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과(재현 19,180원, `npm test` 48 pass, 기존 테스트 약화 없음, `src/format/` 무변경).
남긴 지식: 없음 (이번 Work에서 사람이 새로 알려 준 규칙이 없고, 기존 항목 vat-per-line-floor.md·issued-totals-and-format-frozen.md와 어긋나는 것도 없음)
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`, `src/invoice/total.js` `lineVat`
- 재현: `examples/INV-2047.json`과 `examples/CN-0112.json`으로 `createCreditNote(...).totals`, 기대 합계 19,180
- 테스트: `npm test`, 48 pass
