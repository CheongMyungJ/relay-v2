---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표(CN-0112)와 견적서(Q-0457)를 이번 Work 범위에 포함한다"
    why: "사람 추가 지시: 같은 부가세 버림 규칙으로 2원씩 어긋남"
    by: human
  - what: "완료조건에 CN-0112 합계 19,180원, Q-0457 합계 56,278원을 넣는다"
    why: "사람 추가 지시"
    by: human
assumptions:
  - "반품 전표와 견적서도 줄별 할인 후 금액에 원 단위 버림으로 부가세를 계산하는 규칙이 같다고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표와 견적서의 현재 계산 방식은 확인하지 않았다 (fix에서 확인)"
recommended_next: null
knowledge_candidates: []
---
## 요약
기존 intent(버전 1)에 반품 전표 CN-0112와 견적서 Q-0457을 범위로 추가하고, 완료조건에 두 합계(19,180원, 56,278원)와 각 테스트 항목을 넣었다. 발행 청구서 재계산 금지와 `src/format/` 변경 금지는 유지했다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`).
- 관련 파일: `src/invoice/total.js`, `src/invoice/credit-note.js`, `src/invoice/quote.js`, 예제 `examples/CN-0112.json`, `examples/Q-0457.json`.
- 이전 시도에서 INV-2031은 vat 2,641, 합계 29,079원으로 맞았다. 폐기된 코드는 입력이 아니므로 다시 작업해야 한다.
