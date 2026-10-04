---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "줄별 부가세 계산을 `total.js`의 `lineVat`/`sumLineVat` 한 곳에 두고 견적·반품 전표가 가져다 쓴다"
    why: "세 문서가 같은 규정을 쓰므로 계산이 다시 갈라지지 않게 하려고"
    by: ai
assumptions:
  - "할인 금액의 반올림은 바꾸지 않았다(규정에 말이 없음). 예시 기대값이 그대로 맞았다"
  - "공급가액이 음수인 줄은 없다고 보고 `Math.floor`를 썼다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "INV-2047처럼 발행된 청구서의 저장 부가세(합계 기준 반올림)와 새 규정의 반품 전표 부가세가 몇 원 어긋날 수 있다"
  - "`credit-note.js`가 `total.js`를 import하게 되었다(순환 없음 확인)"
recommended_next: null
knowledge_candidates:
  - "부가세 계산은 `src/invoice/total.js`의 `lineVat`/`sumLineVat`이 담당한다. 청구서·견적·반품 전표 모두 이것을 쓴다"
---
## 요약
부가세를 할인된 과세 줄 금액에 줄마다 원 단위 버림으로 계산해 합하도록 청구서·견적·반품 전표를 고쳤다. 예시 3건이 기대값과 일치하고 `npm test` 55건이 통과한다. 커밋 3907e46.
## 다음 task가 알아야 할 것
- `src/invoice/total.js`: `lineVat`, `sumLineVat`. `quote.js`, `credit-note.js`가 사용
- 새 테스트: `test/vat-rule.test.js` (예시 JSON 3건 포함). 수정 전 6건 실패, 수정 후 통과
- 기존 테스트는 바꾸지 않았다. `src/format/`도 그대로다
