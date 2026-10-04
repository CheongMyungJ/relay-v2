---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "업무 유형을 bugfix 그대로 두고 초안을 쓴다"
    why: "요청은 적립률 정책 변경이라 유형이 맞지 않아 물었고, 사람이 bugfix 유지를 골랐다"
    by: human
assumptions:
  - "적립률 변경 대상은 주문, 선물하기 적립과 부분 환불 회수이며 모두 POINT_RATE_PERCENT를 쓴다"
  - "O-1107의 486P는 (상품 − 쿠폰 − 사용 포인트) 24,330원의 2% 버림이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "기준 브랜치의 earnPoints는 order.amounts.total(배송비 포함 결제 금액)을 쓴다. 적립 기준 규칙(배송비 제외, 버림)은 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 범위를 넓히지 않았다"
  - "부분 환불 회수 로직도 앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "기본 적립률을 2026-10-04 배포부터 1%에서 2%로 올린다. 이미 저장된 적립값과 영수증 글자는 바꾸지 않는다 (사람)"
---
## 요약
적립률 1%→2% 변경을 bugfix 유형으로 초안했다. O-1107은 486P, 저장 주문과 영수증은 그대로 둔다.
## 다음 task가 알아야 할 것
- 적립률 상수: `src/config.js:9` POINT_RATE_PERCENT. 사용처: `src/points/earn.js`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`
- 테스트 명령: `npm test` (node --test)
- 기준 브랜치 earnPoints는 `order.amounts.total` 기준이라 O-1107이 486P가 되는지 확인 필요. 참고: `docs/knowledge/points-earn-excludes-shipping-floor.md` (기준 브랜치에는 아직 없음)
- 선물하기와 환불 회수는 적립 계산을 복제하고 있다(percentOf 직접 호출)
