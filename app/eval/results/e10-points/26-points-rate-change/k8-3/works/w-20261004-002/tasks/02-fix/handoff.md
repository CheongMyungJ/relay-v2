---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "앞선 부분 환불이 있으면 회수 = (그 환불 직전 상품 금액으로 다시 계산한 적립) − (남은 상품 적립). 없으면 저장된 적립 − 남은 상품 적립"
    why: "저장된 적립에서 빼면 앞선 환불의 회수분이 중복된다는 intake의 risk를 피하기 위함. 첫 환불은 intent 공식 그대로"
    by: ai
  - what: "버림 계산을 refund.js 안의 지역 함수 earnedOn으로 둠"
    why: "money.js의 버림 도우미는 머지 대기 중인 Work w-20261004-001과 겹칠 수 있어 범위를 좁힘"
    by: ai
assumptions:
  - "alreadyRefunded 환불 때도 쿠폰·사용 포인트는 남은 주문에 그대로 있다고 본다"
rejected:
  - "단순 환불 금액 × 1% 올림: 사람이 아니라고 함"
open_questions: []
intent_deviation: null
risks:
  - "alreadyRefunded가 있는 경우의 계산(직전 적립 기준)은 정산팀이 확인한 값이 아니다. 테스트의 83P는 이 해석에 따른 값"
  - "w-20261004-001이 머지되면 earnPoints/percentOfFloor와 중복되는 버림 계산이 생긴다. 머지 뒤 공용 도우미로 합칠 수 있음"
  - "저장된 주문의 earned가 옛 계산(배송비 포함·반올림)이면 첫 환불의 회수가 어긋날 수 있음(비목표라 그대로 둠)"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 원래 적립 − 남은 상품 재계산 적립((상품−쿠폰−사용 포인트)×1% 버림, 배송비 제외). 쿠폰·사용 포인트는 남은 주문에 그대로 둠. R-0311은 132P (사람)"
  - "고칠 지식: docs/knowledge/points/earn-base-and-rounding.md — 부분 환불 회수 포인트는 상품 금액 기준이 아니라 위 차감 방식으로 계산한다 (사람)"
---
## 요약
부분 환불 회수 포인트를 원래 적립 − 남은 상품 재계산 적립(버림)으로 고쳤다. R-0311은 131P에서 132P가 됐고 `npm test` 22개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/orders/refund.js`의 `earnedOn`과 `earnedBefore`.
- 테스트: `test/refund.test.js` 마지막 2개. refund.js를 기준 커밋으로 되돌리면 이 2개만 실패한다.
- `alreadyRefunded` 처리는 AI 해석이라 verify에서 확인 필요.
- 기존 테스트(회수 100P)는 쿠폰이 없어 그대로 통과한다.
