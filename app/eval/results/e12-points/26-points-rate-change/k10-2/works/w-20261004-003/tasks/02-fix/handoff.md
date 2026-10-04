---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "주문에 points.ratePercent를 저장하고, 없는 옛 주문은 1%로 보고 환불 회수를 계산한다"
    why: "적립률이 1→2로 바뀌면 옛 주문(1%) 저장 적립을 2%로 재계산해 빼면 회수가 음수·과소가 된다. 완료조건: 바뀐 적립률 아래에서도 저장된 적립과 어긋나지 않음"
    by: ai
  - what: "부분 환불 회수는 0 미만이면 0으로 둔다"
    why: "회수가 음수가 되는 것을 막는 안전장치"
    by: ai
  - what: "선물하기 적립은 계산 방식을 두고 상수만 따라 2%가 된다"
    why: "intent 비목표. 2%로 올릴지는 사람이 모름이라 답한 미정 사항"
    by: ai
  - what: "적립 기준·회수 규칙을 팀 지식대로 구현"
    why: "docs/knowledge/points/earn-basis.md"
    by: ai
assumptions:
  - "적립률 변경 전 저장된 주문은 모두 1%로 적립됐다고 가정(LEGACY_POINT_RATE_PERCENT)"
rejected:
  - "상수만 2로 변경: O-1107이 547이 되어 486과 다름"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 3개 파일(order, gift, refund)의 기대값을 2%에 맞춰 바꿨다(약화 아님, verify 판단 필요)"
  - "앞 Work(w-20261004-002)에서 earnPoints와 refund.js를 고쳤을 수 있음, 머지 대기. 머지 시 같은 파일이 겹칠 수 있다"
  - "선물하기 2% 여부는 미정. 지금 gift-points는 공유 상수를 따라 2%"
  - "points.ratePercent 필드가 새로 저장되어 저장 주문 형식이 늘었다"
recommended_next: null
knowledge_candidates:
  - "적립률이 바뀌면 부분 환불 회수는 주문에 저장된 적립률(points.ratePercent, 없으면 옛 1%)로 재계산해야 한다. 현재 적립률로 계산하면 옛 주문 회수가 어긋난다"
  - "정하지 않음: 선물하기 적립률을 일반 적립률과 같이 올릴지 — 사람이 모른다고 답함, 지금 코드는 공유 상수 POINT_RATE_PERCENT를 따름 (사람)"
---
## 요약
적립률을 2%로 올리고 적립 기준을 상품−쿠폰−사용 포인트 버림으로 맞췄다. O-1107은 486P. 부분 환불 회수는 저장된 적립 − 남은 상품 재계산 적립이며 주문에 저장된 적립률을 쓴다. 전체 취소는 저장값 그대로다. 커밋 9e99a79.
## 다음 task가 알아야 할 것
- `src/points/earn.js` `earnFromBasis`, `src/orders/refund.js` 회수 계산, `src/config.js` 상수
- 재현 테스트 `test/earn-rate.test.js`. `npm test` 27개 통과
- 수정한 기존 기대값: `test/order.test.js`, `test/gift.test.js`, `test/refund.test.js`
- `src/format/` 변경 없음
