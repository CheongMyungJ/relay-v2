---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "부분 환불 회수 포인트 = 환불 전 적립 포인트 − 환불 후 적립 포인트(남은 주문에 쿠폰·사용 포인트 유지)"
    why: "intent 추가 의견에서 fix가 정하라고 함. 적립 규칙과 어긋나지 않고, 나눠 환불해도 합계가 적립을 넘지 않으며 기존 환불 정책(쿠폰·포인트는 남은 주문에 둠)과 맞음"
    by: ai
assumptions:
  - "저장된 points.earned가 옛 규칙 값이어도 부분 환불 회수는 금액에서 새 규칙으로 계산한다(저장 값은 전체 취소에만 쓰임)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "옛 규칙으로 저장된 주문은 earned가 새 규칙보다 커서 부분 환불 회수 합계가 earned보다 적을 수 있음"
  - "환불 회수가 이전 환불 내역(alreadyRefunded)의 수량에 의존함"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트는 환불 전후 적립 포인트의 차이로 계산한다(쿠폰·사용 포인트는 남은 주문에 유지). src/orders/refund.js"
  - "적립 규칙은 src/points/earn.js의 earnBase/pointsOf 한 곳에서 정하고 선물하기와 환불도 이를 쓴다. 적립에 percentOf(반올림)를 쓰면 안 된다"
---
## 요약
적립을 total·반올림 기준에서 (상품−쿠폰−사용 포인트)의 1% 버림으로 고쳤다. O-1042는 237P. 선물하기와 환불 회수도 같은 규칙. `npm test` 27개 통과.
## 다음 task가 알아야 할 것
- 규칙: `src/points/earn.js`(`earnBase`, `pointsOf`), 버림 도우미 `src/money.js` `floorPercentOf`
- 환불: `src/orders/refund.js:36` 환불 전후 차이
- 테스트: `test/earn.test.js` 신규 7개, 수정 전 6개 실패 확인
- 영수증 출력 글자 모양은 그대로(`src/format/` 무변경)
- 커밋 7463140
