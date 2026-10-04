---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "CN-0112의 회계팀 수치는 줄별 버림 값 19,180원일 것이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. credit-note.js에서 충돌할 수 있음"
  - "이미 발행된 반품 전표의 저장된 totals는 재계산하지 않음(비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없었고 코드는 바꾸지 않았다. 완료조건 6개 모두 통과했다. 재현 절차를 다시 돌리면 vat 1,742 / total 19,180이고 `npm test`는 48개 통과다. 테스트 파일 변경은 추가만 있어 약화가 아니다.
남긴 지식: 없음 (기존 항목 vat-per-line-floor.md가 이미 반품 전표 규칙과 수정 이력을 담고 있고 새로 알게 된 규칙이 없음)
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js:90-93`: 줄별 버림 vat
- `test/credit-note.test.js` 끝의 테스트 2개
- 수정 전 코드로 돌리면 `npm test`가 47 통과 / 1 실패
