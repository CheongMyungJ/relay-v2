---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수는 환불 전 기준액 적립 − 환불 후 기준액 적립으로 계산한다"
    why: "나눠 환불해도 회수 합계가 남은 주문의 적립과 어긋나지 않게 하려고(intake의 '어긋나지 않게' 해석)"
    by: ai
assumptions:
  - "이전에 반올림으로 저장된 주문(예: O-1077 earned 403)은 환불 때 새 규칙으로 계산한 값 차이로 회수하며, 저장값과 최대 1P 어긋날 수 있다"
rejected:
  - "배송비만 제외하고 반올림 유지: O-1042가 238P가 되어 237P와 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "고객센터 적립 안내 규칙은 문서가 없고 사람 말에만 의존한다"
  - "기존 반올림 저장 주문의 부분 환불 회수가 저장된 earned와 1P 어긋날 수 있다"
recommended_next: null
knowledge_candidates:
  - "포인트 적립 규칙: 배송비를 제외한 금액(상품금액−쿠폰−사용 포인트)의 적립률을 원 단위 버림한다. 일반 주문, 선물하기, 부분 환불 회수 모두 `src/points/earn.js`의 `earnBase`/`earnOnBase`를 쓴다 (사람)"
---
## 요약
적립을 배송비 제외 기준액의 버림으로 바꿔 O-1042가 237P가 된다. 선물하기와 부분 환불 회수도 같은 규칙을 쓴다. `npm test` 25건 통과.
## 다음 task가 알아야 할 것
- 규칙 위치: `src/points/earn.js`(`earnBase`, `earnOnBase`), 버림 도우미 `src/money.js` `floorPercentOf`
- 환불 회수: `src/orders/refund.js`의 `baseBefore`/`baseAfter` 차이
- G-0213 적립은 218P (24,860−2,000−1,000=21,860)
- 전체 취소와 영수증은 저장된 `points.earned`를 써서 바뀌지 않음(`src/format/` 미수정)
- 새 테스트 5건 추가, 기존 테스트는 수정하지 않음
