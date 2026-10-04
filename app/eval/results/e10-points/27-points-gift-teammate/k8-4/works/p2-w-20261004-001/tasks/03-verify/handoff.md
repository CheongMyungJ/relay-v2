---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "일반 주문 earnPoints는 건드리지 않고 giftPoints가 같은 계산식을 gift-points.js에서 직접 계산한다"
    why: "사람이 일반 주문 규칙에 확신이 없다며 일반 주문 동작 무변경, 선물만 G-0213 218P로 요청"
    by: human
  - what: "리뷰 지적 1(테스트의 동적 import, 사소)을 반영하지 않는다"
    why: "동작에 영향이 없는 스타일 지적이라 사람이 반영하지 않음을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js 부분 환불 pointsRecovered는 percentOf 반올림이라 적립 규칙과 어긋날 수 있다 (비목표)"
  - "선물 계산식이 earnPoints와 복제되어 있어 일반 주문 규칙이 바뀌면 따로 고쳐야 한다"
  - "선물 주문 환불 경로는 확인하지 않았다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(사소)은 반영하지 않았다. 완료조건 6개 모두 통과: 기준 커밋 코드에서는 새 테스트가 실패하고, 최종 코드에서는 G-0213이 218P이며 npm test 24개가 통과한다. 바뀐 테스트 파일은 test/gift.test.js 하나이고 추가만 있어 약화가 아니다.
고친 지식: docs/knowledge/points/order-earn-points.md — 고친 gift-points.js를 '아직 규칙을 따르지 않는 곳'에서 빼고 바뀐 이력만 추가했다(규칙 본문과 사람 출처 표기는 건드리지 않음)
고친 지식: docs/knowledge/points/percent-of-rounding.md — 선물 적립이 percentOf 사용처에서 빠졌음을 반영했다
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: earnPoints에 위임하지 않고 같은 계산식을 직접 둠(사람 요청: 일반 주문 코드 무변경)
- `test/gift.test.js` 마지막 테스트: 일반·선물 적립 비교(G-0213 218P)
- 남은 불일치: `src/orders/refund.js` 환불 회수 포인트(반올림)
