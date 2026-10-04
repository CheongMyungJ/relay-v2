---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(권장, 예제 파일을 읽는 테스트)만 반영하고 2(사소)는 반영하지 않는다"
    why: "사람이 차단·권장만 반영을 선택"
    by: human
assumptions:
  - "CN-0112의 기대값 19,180원은 회계팀 확인 전 값"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "청구서 computeTotals는 이 브랜치에서 아직 Math.round 합계 방식. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
  - "docs/knowledge/credit-note-vat-separate-copy.md는 앞 Work의 같은 경로 파일을 고친 것이라 머지 시 충돌 가능"
  - "저장된 기존 반품 전표의 totals는 재계산하지 않음(비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 권장 1건(예제 파일을 읽는 테스트)을 반영했고 `npm test` 50개가 통과한다. 완료조건 5개 모두 통과, 테스트 변경은 약화 아님.
남긴 지식: docs/knowledge/credit-note-vat-separate-copy.md, docs/knowledge/cn-0112-refund-total.md
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`
- 테스트: `test/credit-note.test.js` 끝 4개 추가(마지막이 예제 파일 읽기)
- 커밋: ed7003e(테스트), 그 뒤 지식 커밋
- 실행: `npm test`
