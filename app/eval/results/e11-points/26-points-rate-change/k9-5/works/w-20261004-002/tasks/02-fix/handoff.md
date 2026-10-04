---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기준 브랜치에 없는 floorPercentOf를 src/money.js에 직접 추가하고 refund.js에서만 쓴다"
    why: "범위는 부분 환불뿐이고 earnBase/earnOnBase는 앞 Work 머지 대기라 이 브랜치에 없다"
    by: ai
assumptions:
  - "환불 전 기준액은 이미 환불한 수량(alreadyRefunded)을 뺀 값이다. 앞선 환불도 같은 차이식이라 합이 맞는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001) 머지 시 floorPercentOf가 src/money.js에서 중복·충돌할 수 있음"
  - "src/points/earn.js, src/gift/gift-points.js는 아직 반올림 결제금액 기준. 앞 Work에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트를 환불 전 기준액 적립 − 환불 후 기준액 적립(버림)으로 바꿨다. O-1077/R-0311은 132P. 재현 테스트는 수정 전 실패, 수정 후 통과하고 `npm test`는 22개 통과다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js`: `baseBefore`, `baseAfter` 계산과 `pointsRecovered`
- `src/money.js`: `floorPercentOf` 추가
- `test/refund.test.js`: 테스트 2개 추가, 기존 테스트 변경 없음
- `refundAmount`, `cancelOrder`, `src/format/`은 건드리지 않음
