---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "회계팀 기대 환불 합계는 줄별 버림으로 계산한 19,180원이라고 본다 (fix의 가정을 그대로 받음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "computeTotals(src/invoice/total.js)는 비목표라 합계 기준 Math.round 그대로다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "회계팀의 정확한 기대 금액은 요청에 없다"
  - "이미 저장된 반품 전표의 totals는 소급하지 않는다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없었다. 완료조건 6개 모두 통과했다(재현 명령 vat 1,742 / total 19,180, npm test 48개 통과). 테스트 파일은 추가만 있어 약화 아님이다.
고친 지식: docs/knowledge/invoice/vat-per-line-floor.md — 앞 내용을 살리고 반품 전표도 줄별 버림이라는 규칙과 CN-0112 예를 더했으며, "아직 규칙을 따르지 않는 곳" 절을 뺐다.
새 지식: docs/knowledge/invoice/credit-note-returned-discount.md — returnedDiscount(수량 비율 나눔, 반올림)를 다루는 기존 항목이 없다.
## 다음 task가 알아야 할 것
- 수정은 `src/invoice/credit-note.js:90-93`, 테스트는 `test/credit-note.test.js` 끝 2개.
- 지식 커밋은 별도(docs). 코드 수정 커밋은 cfc8e96.
- 재현 명령은 fix.md `## 재현`에 있다.
