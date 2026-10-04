---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(환불 회수 기준), 2(경계 테스트)를 반영하지 않는다"
    why: "1은 intent 범위 밖이고 환불 기준 문서가 없다, 2는 사소하다"
    by: human
assumptions:
  - "적립 기준은 O-1042 한 건에서 역산한 것이다 (기준 문서 없음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 포인트 회수(`src/orders/refund.js:34`)는 반올림·상품 환불액 기준이라 새 적립 기준과 다르다"
  - "선물하기 적립은 배송비 포함·반올림 그대로라 일반 주문과 다르다 (G-0213 249P)"
  - "O-1107 등 다른 주문의 적립 안내 기대값은 확인하지 못했다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(환불 회수 기준 권장, 경계 테스트 사소)은 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과했고 `npm test` 22개가 통과한다. `verification.md`와 `pr.md`를 썼다.
새 지식: docs/knowledge/points/earn-points-basis.md — 맞는 기존 항목이 없는 까닭: 지식 항목이 하나도 없었다
새 지식: docs/knowledge/points/gift-points-ownership.md — 맞는 기존 항목이 없는 까닭: 지식 항목이 하나도 없었다
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js` (`total - shipping`, `Math.floor`). 테스트: `test/earn.test.js`.
- 후속 확인: `src/orders/refund.js:34` 부분 환불 회수 기준, 선물하기 적립 기준(다른 팀과 협의).
- 영수증 출력은 `적립 예정` 줄만 달라진다 (O-1042 237P, O-1107 243P).
