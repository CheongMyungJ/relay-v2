---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "리뷰 지적이 없어 반영 선택 질문을 하지 않음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표(src/invoice/credit-note.js:90)는 합계 기준 Math.round 그대로라 원 청구서와 부가세가 어긋날 수 있음(비목표)"
  - "이미 발행된 청구서는 저장된 합계를 쓰므로 이번 수정으로 바뀌지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 완료조건 6개 모두 통과(INV-2031 vat 2641, 합계 29079 직접 재실행, `npm test` 48개 통과). 변경된 테스트 파일은 추가뿐이라 약화 아님.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 부가세 줄별 버림 규칙과 credit-note.js 미적용 상태를 담은 기존 항목이 없음
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/total.js:26-29`
- 테스트: `test/total.test.js` 끝 2개
- 지식: `docs/knowledge/invoice/vat-per-line-floor.md`의 `## 아직 규칙을 따르지 않는 곳`에 credit-note.js 기록
