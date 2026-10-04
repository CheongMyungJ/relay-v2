---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "업무 유형은 선택한 bugfix 그대로 진행한다"
    why: "O-1107의 현재 결과(547P 추정)가 기대값 486P와 달라 현재 동작이 기대와 다르다고 볼 수 있고, 사람이 그대로 진행을 골랐다"
    by: human
  - what: "2% 적용 범위는 일반 주문 적립만이고 선물하기·부분 환불 회수는 비목표로 둔다"
    why: "요청이 기본 적립률과 O-1107 주문 적립만 말한다"
    by: human
assumptions:
  - "기대값 486P는 (상품 − 쿠폰 − 사용 포인트) 24,330원의 2%인 486.6을 버림한 값이라고 보았다. 팀 지식의 적립 규칙(배송비 제외, 버림)과 일치한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 points-earn-rule.md는 앞 Work(w-20261004-001)에서 왔고 머지 대기다. 앞 Work에서 earn.js를 고쳤을 수 있어 이 브랜치의 코드와 다를 수 있다"
  - "환불 회수는 1% 기준으로 남아, 2%로 적립된 새 주문을 부분 환불하면 회수 포인트가 맞지 않을 수 있다. 이번 범위 밖이라 별도 확인이 필요하다"
recommended_next: null
knowledge_candidates:
  - "2026-10-04부터 기본 적립률은 1%에서 2%로 올랐고, 이미 적립된 포인트는 소급 재계산하지 않는다 (사람)"
---
## 요약
새 일반 주문의 적립률을 2%로 올리는 의도 초안을 썼다. 기존 주문 적립값, 영수증 글자, 선물하기·환불 회수는 건드리지 않는다.
## 다음 task가 알아야 할 것
- `src/config.js:9` `POINT_RATE_PERCENT = 1`은 `src/points/earn.js`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`가 함께 쓴다. 값만 올리면 선물·환불도 바뀐다.
- (참고, 확인 안 됨) 현재 `earn.js`는 `order.amounts.total`(배송비 포함)을 `percentOf`(반올림)로 계산한다. O-1107은 total 27,330원이라 2%로 계산하면 547P이고, 기대값 486P는 배송비를 빼고 버림한 값이다.
- 테스트는 `npm test`(`node --test`), 관련 파일은 `test/order.test.js`, `test/refund.test.js`, `test/gift.test.js`, `test/receipt.test.js`다.
- 참고할 팀 지식: docs/knowledge/points-earn-rule.md, points-earned-no-recalc.md, receipt-format-frozen.md, partial-refund-points-recovery.md (모두 기준 브랜치에는 아직 없음)
