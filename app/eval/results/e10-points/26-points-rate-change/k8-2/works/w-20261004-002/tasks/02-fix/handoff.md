---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 재계산을 refund.js 안에서 Math.floor로 직접 계산하고 공용 pointsFor는 만들지 않음"
    why: "pointsFor(src/points/earn.js)는 앞 Work w-20261004-001에서 오며 이 브랜치에 없다. 적립 계산(earnPoints)은 비목표라 건드리지 않음"
    by: ai
assumptions:
  - "남은 상품 재계산 때 쿠폰과 사용 포인트는 전액 그대로 뺀다(intent 원하는 결과)"
rejected:
  - "1% 올림(132P): 사람이 올림이 아니라고 답함"
open_questions: []
intent_deviation: null
risks:
  - "alreadyRefunded가 있는 여러 번 부분 환불에서는 식이 이전 환불 회수분까지 포함한 누적 회수량을 낸다. 정산팀 예시가 없어 확인하지 않음"
  - "앞 Work(w-20261004-001)에서 pointsFor로 정리했을 수 있음, 머지 대기. 머지 뒤 refund.js의 계산을 pointsFor로 합칠 수 있음"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 저장된 원래 적립 − 남은 상품 재계산 적립(버림, 쿠폰·사용 포인트는 남은 주문에 그대로) (사람)"
  - "고칠 지식: docs/knowledge/points/earn-basis.md — 부분 환불 회수는 환불 상품 금액의 1%가 아니라 원래 적립 − 남은 상품 재계산 적립(버림)이다 (사람)"
---
## 요약
`createRefund`의 회수 포인트를 원래 적립 − 남은 상품 재계산 적립(버림)으로 고쳤다. O-1077/R-0311이 131P에서 132P가 되고 환불 금액은 13,130원 그대로다. 재현 테스트를 추가했고 `npm test` 21개 통과.
## 다음 task가 알아야 할 것
- 변경: `src/orders/refund.js` pointsRecovered 계산, 테스트는 `test/refund.test.js` 끝.
- 여러 번 부분 환불은 누적 회수가 되는 점 미확인(risks).
- `src/gift/gift-points.js`, `earnPoints`는 그대로(비목표).
