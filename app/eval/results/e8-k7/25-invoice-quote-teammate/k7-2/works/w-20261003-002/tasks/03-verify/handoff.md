---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(면세 혼합 테스트 추가, 사소)을 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 선택"
    by: human
assumptions:
  - "회계팀 기대값은 팀 지식 규칙으로 계산한 19,180원이라고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "청구서(src/invoice/total.js)와 견적도 같은 문제일 수 있으나 비목표. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
  - "returnedDiscount의 금액 할인 안분은 반올림이라 규칙 해석이 다르면 별도 확인 필요"
  - "면세 줄 혼합 반품 전표의 부가세 테스트가 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건이고 반영하지 않았다. 완료조건 7개 모두 통과, 테스트 파일 변경은 약화 아님. `npm test` 50개 통과, CN-0112 19,180원 확인.
남긴 지식: 없음 (반품 전표의 줄별 버림 규칙은 기존 docs/knowledge/vat-floor-per-line.md가 이미 반품 전표를 덮고, 이 Work에서 새로 사람이 알려 준 규칙이 없음)
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` creditTotals(약 90줄)
- 테스트: `test/credit-note.test.js` 끝 2개
- 확인: `npm test`, CN-0112 직접 실행 vat 1742 / total 19180
