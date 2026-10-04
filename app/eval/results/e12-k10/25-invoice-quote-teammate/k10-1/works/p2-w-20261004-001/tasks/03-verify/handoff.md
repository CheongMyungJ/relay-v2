---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "사소 지적 1건(테스트 동적 import)은 반영하지 않는다"
    why: "동작 차이가 없고 테스트 파일을 더 건드리지 않는 편이 안전"
    by: human
assumptions: []
rejected:
  - "테스트의 동적 import를 정적 import로 바꾸기: 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "견적서 부가세 규정은 미확정. 줄별 버림이 경리 값과 맞는 것만 확인함"
  - "추가한 테스트를 기준 커밋에서 따로 실행해 실패를 확인하지 못함(기준 커밋은 로드 실패)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건뿐이며 반영하지 않았다. 완료조건 6개 모두 통과(npm test 55개 통과, Q-0457 56,278원).
고친 지식: docs/knowledge/billing/vat-per-line-floor.md — 견적 사용을 규칙에서 빼고 견적 규정 미정을 '아직 정하지 않은 것'에 추가
새 지식: docs/knowledge/billing/merge-duplicate-shared-function.md — 머지 중복 선언 함정을 다룬 기존 항목이 없음
## 다음 task가 알아야 할 것
- `src/money.js:48` `vatOfLines(rows, percent, zeroRated)`; 호출 quote.js, total.js, credit-note.js
- 견적 규정은 담당 동료 휴가 복귀 후 확인
