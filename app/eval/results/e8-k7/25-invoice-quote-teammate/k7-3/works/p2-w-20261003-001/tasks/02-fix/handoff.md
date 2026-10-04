---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서 합계가 재현되지 않아 관찰 사실만으로 진행하고, npm test 실패 원인인 반품 전표 import 누락만 고친다"
    why: "기준 커밋에서 Q-0457은 이미 56,278원이다. 사람이 '관찰 사실만으로 진행'을 선택했다"
    by: human
  - what: "반품 전표 계산은 건드리지 않고 VAT_RATE_PERCENT import만 추가한다"
    why: "팀 지식 no-recalc-issued-and-format.md: 저장된 totals는 재계산하지 않는다. 계산 로직 변경 없이 import만 고침"
    by: ai
assumptions:
  - "56,280원은 합계 기준 Math.round 방식의 옛 결과였고 a8348c6이 이미 고쳤다고 본다(옛 코드로 실행해 확인하지 않음)"
rejected:
  - "견적서 코드가 합계 기준 반올림을 쓴다: 현재 quote.js는 vatOfRows(줄별 버림)를 쓴다"
open_questions: []
intent_deviation:
  summary: "의도의 버그(견적서 56,280원)가 기준 커밋에서 이미 재현되지 않는다"
  evidence: "Q-0457 totals 출력이 total 56278, vat 3587. 견적서는 a8348c6에서 이미 수정됨"
risks:
  - "56,278원이 회계팀의 공식 견적서 부가세 규칙(줄별 버림)에서 나온 값인지는 사람이 확인하지 못했다. 줄별 버림과 결과는 일치한다"
  - "저장된 옛 견적서 totals가 56,280원이면 그대로 남아 있을 수 있다(확인 못 함)"
recommended_next: null
knowledge_candidates:
  - "Q-0457 견적서는 줄별 원 단위 버림으로 vat 3,587, 합계 56,278원이고 경리 계산과 일치한다. 견적서에도 줄별 버림이 맞게 보인다 (사람이 경리 금액을 알려 줌)"
  - "credit-note.js에서 VAT_RATE_PERCENT import가 빠져 반품 전표 테스트 5건이 실패한 적이 있다. 상수를 쓰는 줄을 고칠 때 import를 확인할 것"
---
## 요약
견적서 Q-0457은 기준 커밋에서 이미 56,278원이라 재현되지 않았다. 사람이 관찰 사실만으로 진행하기로 했고, 대신 npm test를 막던 반품 전표의 import 누락(`VAT_RATE_PERCENT`)을 고쳐 53건 모두 통과시켰다.
## 다음 task가 알아야 할 것
- `src/invoice/quote.js:38` `quoteTotals`는 `vatOfRows`(`src/invoice/total.js`)로 줄별 버림 합을 계산한다. Q-0457: vat 3,587, total 56,278.
- 고친 곳: `src/invoice/credit-note.js` 1줄 import. 반품 전표 계산·`src/format/`·quote.js는 그대로.
- `npm test`: 53 pass / 0 fail. 수정 전 5건 실패는 기준 커밋에서도 실패했다.
