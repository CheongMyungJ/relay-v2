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
  - "sumCreditLineVat는 앞 Work(w-20261004-001)의 sumLineVat와 중복이다. 앞 Work에서 고쳤을 수 있음, 머지 대기. 머지 뒤 합쳐야 한다"
  - "computeTotals는 이번 범위 밖이라 합계 반올림이 남아 있을 수 있음 (앞 Work에서 고쳤을 수 있음, 머지 대기)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 재현(CN-0112 19,180원)과 npm test 49개 통과를 직접 다시 확인했고 완료조건 7개 모두 통과다. 테스트 파일은 추가만 있어 약화 아님이다.
고친 지식: docs/knowledge/invoice/vat-per-line-floor.md — 반품 전표도 줄마다 버림으로 고쳤음을 적고 CN-0112 예와 sumCreditLineVat 중복(아직 규칙을 따르지 않는 곳)을 더함
새 지식: docs/knowledge/invoice/credit-note-returned-discount.md — returnedDiscount 규칙을 다루는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js`의 `sumCreditLineVat`, `creditTotals`
- 테스트: `test/credit-note.test.js` 끝 새 테스트 3개
- 명령: `npm test` (49개 통과)
- 산출물: `verification.md`, `pr.md`
