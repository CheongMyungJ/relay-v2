---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "리뷰 지적이 없어 사람에게 반영 선택을 묻지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "creditTotals가 공용 lineVat/sumLineVat 대신 직접 계산한다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 뒤 공용 함수로 교체 가능"
  - "청구서·견적(src/invoice/total.js)은 사람이 범위에서 뺐고 합계 반올림이 남아 있을 수 있다"
  - "영세율·면세 줄을 직접 확인하는 새 테스트는 없다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 완료조건 7개 모두 통과, 테스트 파일 변경은 약화 아님. CN-0112 재현은 환불 합계 19,180원, `npm test` 49개 통과.
고친 지식: docs/knowledge/billing/vat-per-line-floor.md — 앞 Work 내용을 살려 같은 경로에 쓰고, 반품 전표 규칙과 예(CN-0112), creditTotals가 공용 함수를 아직 안 쓰는 점, 이력을 더했다
새 지식: docs/knowledge/billing/credit-note-stored-amounts.md — 저장 금액 불변, returnedDiscount 수량 비율 분할, format 불변을 다루는 기존 항목이 없다
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`
- 재현 테스트: `test/credit-note.test.js` 마지막 테스트 (수정 전 코드에서 실패 확인)
- 재현: `node`로 INV-2047에 CN-0112 적용 → vat 1742, total 19180
