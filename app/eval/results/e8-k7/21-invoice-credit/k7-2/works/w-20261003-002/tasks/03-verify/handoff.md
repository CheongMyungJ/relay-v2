---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)을 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 고름"
    by: human
  - what: "docs/knowledge/credit-note-vat-separate-copy.md를 반품 전표도 줄별 버림으로 맞췄다는 내용으로 갱신"
    why: "기존 항목이 '전표는 합계 반올림 그대로'라고 적혀 있어 이 Work 이후 사실과 다르다"
    by: ai
assumptions:
  - "회계팀 계산은 줄별 버림 부가세 방식이라고 가정함. CN-0112의 회계팀 숫자는 직접 확인하지 못함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: 이 브랜치의 청구서 부가세는 아직 합계 반올림이라 같은 청구서의 반품 부가세와 1~몇 원 어긋날 수 있음"
  - "반품 줄 할인 Math.round(322.5원이 323원)가 회계팀 방식과 같은지 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이고 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과: CN-0112 환불 합계 19,180원(부가세 1,742원), `npm test` 48개 통과, `src/format/` 변경 없음, 저장 totals 경로 변경 없음. 바뀐 테스트 파일은 추가만 있어 약화 아님. `pr.md`를 썼다.
남긴 지식: docs/knowledge/credit-note-vat-separate-copy.md
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/credit-note.js` `creditTotals`(줄별 Math.floor 합).
- 확인 명령: `npm test`, 재현은 `createCreditNote(examples/INV-2047.json, examples/CN-0112.json).totals`.
- 지식 파일은 앞 Work의 같은 경로 파일을 갱신한 것이다. 머지 순서에 따라 충돌할 수 있다.
