---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(사소)을 반영하지 않는다"
    why: "사람이 반영하지 않음을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "고객센터 규칙은 237P 한 건과 요청 설명으로 추론했다"
  - "선물하기 적립은 배송비 포함+반올림이라 일반 주문과 다르다(비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이고 반영하지 않았다. 완료조건 6개 모두 통과했고 `npm test` 22개가 통과한다. 테스트 파일 변경은 추가뿐이라 약화가 아니다.
새 지식: docs/knowledge/points/earn-basis.md — 적립 기준과 관련된 기존 항목이 없어 새로 만듦
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js:5`
- 지식: `docs/knowledge/points/earn-basis.md`에 적립 기준 규칙과, 선물하기 적용 여부는 미정으로 기록함
- 재현 확인: O-1042 237P, O-1077 423P, O-1107 243P
