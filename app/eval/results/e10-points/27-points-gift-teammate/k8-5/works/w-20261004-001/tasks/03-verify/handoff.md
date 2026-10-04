---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(refund.js 회수 식), 2(경계 테스트)를 반영하지 않는다"
    why: "1번은 환불 정책 확인이 필요하고 intent 목표 밖이다. 2번은 사소하다"
    by: human
assumptions:
  - "237P 식은 고객센터 값에서 거꾸로 맞춘 것이며 정책 문서로 확인하지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수 포인트(src/orders/refund.js:34)가 반올림, 상품 금액 기준이라 적립보다 1P 더 회수할 수 있다"
  - "선물하기 적립(src/gift/gift-points.js)은 옛 식이라 같은 과다 적립이 있을 수 있다. 비목표"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(권장 1, 사소 1)은 사람이 반영하지 않기로 했다. 완료조건 7개 모두 통과했다. `npm test` 24개 통과, 새 테스트는 수정 전 코드에서 실패한다. 기존 테스트 파일 변경 없음.
새 지식: docs/knowledge/points/earn-points-formula.md — 적립 식에 대한 기존 항목이 없어서
새 지식: docs/knowledge/points/stored-points-not-recalculated.md — 저장값 재계산 금지 규칙에 대한 기존 항목이 없어서
새 지식: docs/knowledge/points/gift-points-hands-off.md — 선물하기 적립 불가침 규칙에 대한 기존 항목이 없어서
## 다음 task가 알아야 할 것
- `src/points/earn.js`: floor((total − shipping) × 1 / 100)
- `src/orders/refund.js:34`: 회수 식이 percentOf라 적립 식과 다르다 (후속 확인 필요)
- `src/gift/gift-points.js`: 옛 식, 협의 전 수정 금지
- `docs/knowledge/points/`에 규칙 3개를 남겼다
