---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: 이 브랜치에 vatOfRows가 없어 credit-note.js에 vatOfNet을 따로 둠. 머지 후 중복 가능. 청구서·견적서(total.js)는 이 브랜치에서 합계 반올림 그대로"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 재현 절차(CN-0112 vat 1,742, 합계 19,180), `npm test` 49 통과, 저장값 우선, src/format 무변경, 새 테스트 모두 직접 확인해 완료조건 6개 통과. 테스트 파일 변경은 약화 아님.
남긴 지식: docs/knowledge/no-recalc-issued-and-format.md (만든 반품 전표도 재계산 금지 추가)
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `vatOfNet`, `creditTotals`.
- 테스트: `test/credit-note.test.js` 마지막 테스트.
- 지식 파일은 앞 Work의 내용을 모두 살려 반품 전표 문장만 추가함.
