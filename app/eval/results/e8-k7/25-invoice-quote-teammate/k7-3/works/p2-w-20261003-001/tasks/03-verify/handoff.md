---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "재현 불가로 판정 불가인 완료조건은 그대로 두고 완료 화면으로 간다. 그 전에 INV-2031, CN-0112도 현재 코드로 확인한다"
    why: "사람이 요청했다. INV-2031 vat 2,641 / 합계 29,079, CN-0112 vat 1,742로 줄별 버림 기준과 맞았다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation:
  summary: "의도의 버그(견적서 56,280원)가 기준 커밋에서 이미 재현되지 않는다"
  evidence: "Q-0457 totals 출력이 total 56278, vat 3587. 견적서는 a8348c6에서 이미 수정됨"
risks:
  - "저장된 옛 견적서 totals가 56,280원이면 그대로 남아 있을 수 있다(확인 못 함)"
  - "56,278원이 회계팀의 공식 견적서 규칙에서 나온 값인지는 계산 일치로만 확인했다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없다. 변경은 `credit-note.js`의 import 1줄뿐이고 `npm test`는 53/53 통과, Q-0457은 56,278원이다. 재현 절차 완료조건은 한 번도 실패한 적이 없어 판정 불가다. 사람이 요청한 INV-2031·CN-0112도 줄별 버림 값과 맞았다.
남긴 지식: 없음 (줄별 버림 규칙과 예시 수치는 기존 docs/knowledge 항목에 이미 있다)
## 다음 task가 알아야 할 것
- 확인 값: INV-2031 vat 2641 / total 29079 (`computeTotals`), CN-0112(INV-2047 발행분 기준) vat 1742 / total 19180, Q-0457 vat 3587 / total 56278.
- 변경 파일: `src/invoice/credit-note.js:1`.
- 판정 불가: 재현 절차 완료조건(재현 없이 진행).
