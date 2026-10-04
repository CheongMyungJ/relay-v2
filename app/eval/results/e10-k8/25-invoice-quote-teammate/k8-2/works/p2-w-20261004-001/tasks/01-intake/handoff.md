---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "Q-0457 기대 합계는 56,278원으로 한다"
    why: "사람이 경리 담당 계산값을 알려 줬고, 팀 지식의 줄별 버림 규정으로 계산해도 같은 값임"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "거래처가 받은 56,280원이 어느 버전이나 경로에서 나왔는지는 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "견적 Q-0457(C-0388)은 줄별 부가세 995·841·886·865 = 3,587원, 합계 56,278원이다(경리 담당 계산). 과세분에 한 번 계산하면 56,280원이라 틀린다. (사람)"
---
## 요약
Q-0457 견적 합계가 회계팀 부가세 규정과 맞도록 고치는 의도를 정리했다. 견적 번호 형식과 유효 기간 계산은 비목표다.
## 다음 task가 알아야 할 것
- 테스트는 `npm test`(`node --test`)다. 참고 지식은 docs/knowledge/invoice/vat-per-line-floor.md, issued-totals-and-format.md다.
- 계산 확인: Q-0457은 공급가액 52,691원, 과세분 35,891원, 줄별 버림 부가세 3,587원(995·841·886·865), 합계 56,278원이다. 과세분에 한 번 계산하면 부가세 3,589원, 합계 56,280원이다. 견적 줄별 버림은 커밋 c7acce6에서 적용됐다.
- 관찰(가설, 원인 단정 아님): `src/invoice/quote.js:40`은 이미 `lineVatSum`을 쓰는데, `src/invoice/total.js`에 `lineVatSum`이 18행과 39행에 두 번 선언돼 있다. `quote.js`를 불러오면 "Identifier 'lineVatSum' has already been declared"로 실패한다. 머지 중복으로 보인다.
- 견적 데이터는 `examples/Q-0457.json`이다.
