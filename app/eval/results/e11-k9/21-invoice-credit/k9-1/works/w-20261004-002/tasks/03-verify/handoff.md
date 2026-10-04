---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "회계팀의 CN-0112 기대 합계는 모르므로 규칙 적용 결과(19,180원)가 회계팀 계산과 같다고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이미 저장된 전표의 totals는 다시 계산하지 않아 틀린 금액이 남음(비목표)"
  - "returnedDiscount 반올림은 범위 밖으로 둠"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기 (청구서 쪽 부가세 계산)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 재현 절차와 `npm test`(47개)를 다시 실행해 모든 완료조건이 통과했다. 테스트 파일 변경은 재현 테스트 추가뿐이라 약화 아님이다.
고친 지식: docs/knowledge/invoice/vat-per-line-floor.md — 앞 Work의 항목을 살려 같은 경로에 쓰고, 반품 전표를 '아직 규칙을 따르지 않는 곳'에서 빼고 CN-0112 예와 이력을 더했다.
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/credit-note.js` `creditTotals` (90-93줄)
- 재현: INV-2047 + CN-0112 → vat 1742, total 19180
- 지식 파일은 이 브랜치에서 새로 생기며 머지 순서에 따라 w-20261004-001 쪽과 합쳐야 할 수 있다
