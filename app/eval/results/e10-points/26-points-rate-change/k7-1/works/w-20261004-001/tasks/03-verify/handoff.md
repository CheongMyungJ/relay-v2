---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1, 2(환불 회수가 적립보다 클 수 있음)를 모두 반영한다"
    why: "사람이 회수가 적립보다 크면 안 된다며 환불 회수도 (상품−쿠폰−사용 포인트)의 1% 버림 기준으로 맞추라고 함. 영수증 글자와 저장된 적립값은 건드리지 않음"
    by: human
  - what: "회수는 환불 전후 적립 기준 금액의 earnOn 차이로 계산한다"
    why: "합계가 적립을 넘지 않고 쿠폰·사용 포인트가 남은 주문에 남는다는 기존 규칙과 맞음"
    by: ai
assumptions:
  - "O-1077.json은 저장된 주문 파일이라 CLI에 입력으로 넣으면 423P로 나오는 것은 코드 문제가 아님"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "적립 기준은 O-1042 한 건에서 추정하고 사람이 확인함. G-0213 218P는 안내 값 미확인"
  - "저장된 주문의 적립값은 소급 수정하지 않음(비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(환불 회수가 적립보다 클 수 있음)을 사람이 골라 반영했다(커밋 de4ec09). 완료조건 5개 모두 통과, `npm test` 26개 통과. 테스트 파일은 추가만 있어 약화 아님.
남긴 지식: docs/knowledge/points-earn-excludes-shipping-floor.md, docs/knowledge/refund-recovery-follows-earn-rule.md, docs/knowledge/points-earn-saved-orders-not-recomputed.md
## 다음 task가 알아야 할 것
- `src/orders/refund.js`의 `createRefund`: 회수 = `earnOn(전 기준) − earnOn(후 기준)`.
- O-1077 줄별 환불 회수는 132, 83, 129P(합계 344 ≤ 403). R-0311 환불은 -132P.
- `examples/O-1077.json`은 저장된 주문 파일이라 `--order`로 쓴다.
