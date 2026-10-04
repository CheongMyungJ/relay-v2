---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 합계를 56,278원으로 둔다"
    why: "팀 지식 항목(vat-per-line-floor.md)에 Q-0457 합계 56,278원이 회계팀 기준으로 적혀 있음"
    by: ai
assumptions:
  - "경리가 계산한 값이 팀 지식의 56,278원과 같다고 보았다 (요청에는 경리 금액이 없음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "intake에서는 코드를 실행하지 않아 현재 값 56,280원의 원인은 확인하지 않았다"
recommended_next: null
knowledge_candidates: []
---
## 요약
견적서 Q-0457 합계를 경리 기준(56,278원)에 맞추는 버그 수정 의도를 정리했다. 견적 번호 형식과 유효 기간 계산은 비목표로 못 박았다.
## 다음 task가 알아야 할 것
- 참고 지식: `docs/knowledge/invoice/vat-per-line-floor.md`
- 테스트: `npm test` (node --test)
- 합계 계산은 `src/invoice/quote.js`의 `quoteTotals`, 줄별 부가세는 `src/invoice/total.js`의 `lineVat(net)`.
- 내 가설(참고용, 확인 안 됨): `quote.js`의 `taxableRows.map(lineVat)`는 `lineVat`에 숫자 net이 아니라 행 객체를 넘기는 것처럼 보인다. 실제 동작은 fix에서 확인할 것.
- 입력: `examples/Q-0457.json` (과세 4줄 + 면세 1줄, 할인 포함)
