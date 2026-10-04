---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, CN-0112 예시 테스트 추가)을 반영"
    why: "사람이 모두 반영을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 computeVat과 청구서 쪽을 고쳤을 수 있음, 머지 대기"
  - "청구서 computeTotals는 아직 Math.round(합계)를 씀 (비목표)"
  - "비율 할인의 부분 반품 반올림 규칙은 정해지지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 결과 차단·권장 지적은 없었고, 사소 지적 1건(CN-0112 예시 테스트)을 반영했다. 완료조건 8개 모두 통과, `npm test` 50개 통과. `pr.md` 작성.
남긴 지식: 없음 (이번 일에서 새로 알게 된 규칙은 앞 Work의 팀 지식 항목이 이미 담고 있고, 고칠 내용이 없음)
## 다음 task가 알아야 할 것
- 반영 커밋 317438d (`test/credit-note.test.js` 끝의 CN-0112 테스트)
- 재현: INV-2047 + CN-0112 → vat 1742, total 19180
- `src/format/` 변경 없음
