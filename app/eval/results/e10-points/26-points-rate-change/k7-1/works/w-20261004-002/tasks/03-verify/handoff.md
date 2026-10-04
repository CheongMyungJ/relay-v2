---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수를 저장된 적립 − 남은 상품으로 재계산한 적립으로 바꾼다 (이전 환불은 같은 식의 이전 회수를 뺌)"
    why: "사람이 정산 기준을 알려 줌: 저장 적립과 재계산값이 다른 주문에서 어긋남"
    by: human
  - what: "사소 지적 2·3(index export, 이전 회수 이력)은 반영하지 않는다"
    why: "범위 밖이고 영향이 작다"
    by: ai
assumptions:
  - "이전 부분 환불의 회수는 같은 식으로 계산된 값이라고 본다"
rejected:
  - "환불 전후 재계산 차이: 저장 적립이 재계산과 다르면 정산 기준과 어긋남"
open_questions: []
intent_deviation: null
risks:
  - "earnPoints(주문 적립)는 아직 결제 금액을 반올림한다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "earn.js의 earnOn이 앞 Work와 중복될 수 있어 머지 때 충돌 가능"
  - "이전 환불의 실제 회수 이력이 입력에 없다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 후 사람의 요청으로 회수를 `저장된 적립 − earnOn(남은 상품 − 쿠폰 − 사용 포인트)`로 바꿨다. 모든 완료조건 통과, `npm test` 24 pass, R-0311은 132P.
남긴 지식: docs/knowledge/refund-recovery-follows-earn-rule.md
## 다음 task가 알아야 할 것
- `src/orders/refund.js` createRefund의 `recoveredUpTo`, `src/points/earn.js`의 `earnOn`.
- 확인: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P. 저장 423P 주문은 152P(test/refund.test.js).
- 커밋: 4d47797(코드), 그 뒤 docs 커밋.
