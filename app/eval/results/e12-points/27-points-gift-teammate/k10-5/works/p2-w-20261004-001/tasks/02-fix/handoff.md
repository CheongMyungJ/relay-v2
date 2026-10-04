---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 호출하게 해 선물 적립도 일반 적립과 같은 기준을 쓴다"
    why: "docs/knowledge/points/earn-points-basis.md 규칙(상품−쿠폰−사용 포인트, 1% 내림, 배송비 제외). intent가 선물하기 수정을 범위로 삼아 지식의 '범위에서 뺌'은 적용하지 않음"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js:34 부분 환불 회수는 여전히 반올림이라 새 적립과 1P 어긋날 수 있음 (이번 범위 밖)"
recommended_next: null
knowledge_candidates:
  - "지금은 선물하기 적립(src/gift/gift-points.js)도 earnPoints를 쓴다. 지식 항목의 '아직 규칙을 따르지 않는 곳'에서 gift-points 줄을 뺀다 (사람이 이번 Work 범위로 정함)"
---
## 요약
G-0213이 249P로 나온 원인은 `giftPoints`가 결제 금액에 반올림 `percentOf`를 쓴 것이었다. `earnPoints`를 쓰게 고쳐 218P가 나온다. 재현 테스트를 추가했고 `npm test` 22개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js` (earnPoints 호출)
- 테스트: `test/gift.test.js` 마지막 테스트, 수정 전 249로 실패 확인
- 환불 회수(`src/orders/refund.js:34`)는 손대지 않음
