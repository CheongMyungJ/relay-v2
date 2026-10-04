---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "Q-0457의 기준 합계를 경리 담당이 계산한 56,278원으로 한다"
    why: "사람이 경리 담당의 계산 금액을 직접 알려 줌. 현재 견적서는 56,280원으로 2원 크다"
    by: human
assumptions: []
rejected:
  - "팀 지식 vat-per-line-floor.md의 줄별 버림 규칙을 견적서에 확정 적용: 이번 요청에서 사람이 확인하지 않았고, credit-note-quote-vat-differs.md는 따로 정해야 한다고 적어 충돌함"
open_questions:
  - "견적서 부가세를 줄별 원 단위 버림의 합으로 계산하는 게 회계팀 기준인가? 사람이 모른다고 답했다. 56,278원이 이 규칙과 맞는지 fix에서 확인이 필요하다"
intent_deviation: null
risks:
  - "56,278원이 어떤 규칙에서 나온 값인지 모른다. 규칙 없이 금액만 맞추면 다른 견적서가 틀릴 수 있다"
  - "src/invoice/quote.js는 이미 vatOfRows를 쓰는 것으로 보여 코드만으로는 불일치가 안 보인다. 56,280원의 출처는 fix에서 확인해야 한다"
recommended_next: null
knowledge_candidates:
  - "견적서 Q-0457의 경리 담당 계산 합계는 56,278원이다. 이 Work 시작 때 견적서 값은 56,280원이었다 (사람)"
---
## 요약
견적서 Q-0457 합계가 경리 계산과 2원 다른 버그의 의도를 정리했다. 기준 합계는 경리 담당이 계산한 56,278원이고, 부가세 규칙은 사람이 몰라 open_questions에 남겼다. 견적 번호 형식, 유효 기간 계산, src/format/은 바꾸지 않는다.
## 다음 task가 알아야 할 것
- 데이터: `examples/Q-0457.json`, 계산: `src/invoice/quote.js`의 `quoteTotals`. 테스트는 `npm test`(node --test).
- (참고, 확인 안 됨) quote.js는 현재 `vatOfRows`(`src/invoice/total.js`)를 쓴다. 56,280원이 이 코드의 결과인지, 다른 경로(저장된 totals 등)인지 먼저 확인할 것.
- 2원 차이는 부가세 반올림 방식 차이일 수 있다는 것은 내 추측이다. 원인으로 단정하지 말고 계산해서 확인할 것.
- 참고 지식(근거가 아님): `docs/knowledge/vat-per-line-floor.md`(견적서도 같은 규칙이라고 적음), `docs/knowledge/credit-note-quote-vat-differs.md`(따로 정해야 한다고 적음). 두 항목은 서로 충돌한다.
