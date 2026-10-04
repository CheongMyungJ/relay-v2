---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(사소)을 모두 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 골랐다"
    by: human
assumptions:
  - "회계팀 기준 금액은 줄별 버림 방식(CN-0112 1,742원/19,180원)과 같다고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "비율 할인과 수량 비례 금액 할인의 Math.round는 그대로여서 다른 전표에서 할인액이 1원 다를 수 있음"
  - "영세율·면세 혼합 반품 전표는 테스트로 고정되어 있지 않음"
  - "청구서 쪽 total.js는 범위 밖이며 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
모든 완료조건 통과. 재현 절차 재실행 결과 CN-0112는 부가세 1,742원, 합계 19,180원이고 `npm test` 48개 통과. 리뷰 지적 2건(사소)은 사람이 반영하지 않기로 했다. 테스트 파일 변경은 추가뿐이라 약화 아님.
고친 지식: docs/knowledge/invoice/vat-per-line-floor.md — 반품 전표(CN-0112) 예를 규칙에 더하고 credit-note.js를 미준수 목록에서 지움(앞 Work의 항목이라 같은 경로에 앞 내용을 살려 다시 씀)
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`. 테스트: `test/credit-note.test.js` 끝 2개.
- 산출물: verification.md, pr.md. `src/format/` 변경 없음.
