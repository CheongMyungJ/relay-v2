---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소: 저장값 사용 확인 테스트 추가)은 반영하지 않는다"
    why: "사람이 반영하지 않기로 함"
    by: human
  - what: "부분 환불 포인트 회수를 적립 기준(버림)에 맞추고 저장된 적립값을 넘지 않게 고친다"
    why: "사람이 요청: 환불 회수가 적립과 어긋나면 같이 고쳐야 한다"
    by: human
  - what: "회수 = min(floor(환불 상품 금액 × 1%), 저장된 points.earned)"
    why: "쿠폰·사용 포인트는 남은 주문에 남고 환불 가능 금액이 상품-쿠폰-포인트로 제한돼 버림 합계가 적립값을 넘지 않는다. 상한은 방어용"
    by: ai
assumptions:
  - "적립 기준(배송비 제외, 버림)은 O-1042의 237P 하나로 추론한 것이라 다른 주문으로 확인하지 못함"
rejected: []
open_questions: []
intent_deviation:
  summary: "intent 비목표는 환불 시 포인트 회수(src/orders/refund.js)를 범위에서 뺐지만, 사람의 요청으로 이 Work에서 고쳤다"
  evidence: "verify 단계 사람 요청, 커밋 부분 환불 포인트 회수를 적립 기준에 맞춰 버림하고 적립값을 넘지 않게 한다"
risks:
  - "alreadyRefunded에 이전 회수 포인트가 없어 나눠 환불한 합계 상한은 버림 합계의 성질에 기댄다. 옛 식으로 이미 회수된 환불은 다시 계산하지 않는다"
  - "선물하기 적립(src/gift/gift-points.js)은 옛 식(배송비 포함, 반올림)"
recommended_next: null
knowledge_candidates:
  - "적립 기준은 배송비를 뺀 결제 금액의 1%, 원 단위 미만 버림"
  - "부분 환불 회수도 같은 기준(버림)이고 적립값을 넘지 않는다"
---
## 요약
리뷰 지적은 사소 1건이고 사람이 반영하지 않기로 했다. 사람 요청으로 부분 환불 회수를 적립 기준에 맞춰 고쳤다(`src/orders/refund.js:34`). O-1042 전체 취소는 237P 그대로이고 저장된 적립값은 재계산하지 않는다. 완료조건 6개 모두 통과, `npm test` 29개 통과.
남긴 지식: docs/knowledge/points-earn-basis.md, docs/knowledge/refund-recovery-vs-earn-basis.md
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, `src/orders/refund.js:34`, 테스트: `test/earn.test.js`, `test/refund.test.js`
- 확인 명령: `node src/cli.js examples/O-1042.json`, `npm test`
