---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "부분 환불 회수 = 환불 전 남은 주문 적립분 − 환불 뒤 남은 주문 적립분"
    why: "환불 계산 방식을 사람이 정하지 않아 적립 기준과 어긋나지 않게 하는 방식으로 정함. 여러 번 환불해도 합이 적립분과 같다"
    by: ai
assumptions:
  - "환불 회수는 현재 규칙으로 다시 계산하므로, 옛 기준으로 저장된 주문의 부분 환불 회수는 저장된 earned와 몇 P 어긋날 수 있다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "옛 기준으로 적립·저장된 주문을 부분 환불하면 회수액이 저장된 points.earned보다 클 수 있다(저장값은 재계산하지 않기로 했으므로 그대로 둠)"
  - "UI 영수증 출력은 직접 실행해 보지 않았고 기존 영수증 테스트 통과로만 확인"
recommended_next: null
knowledge_candidates:
  - "적립 코드 위치: src/points/earn.js의 earnFromAmounts가 일반·선물·환불 회수의 공통 기준(버림). 새 적립 경로는 이 함수를 쓴다"
---
## 요약
적립을 (상품−쿠폰−사용 포인트)의 1% 버림으로 바꿨다. O-1042는 237P, G-0213은 218P. 부분 환불 회수도 같은 기준으로 계산한다. 테스트 25개 통과.
## 다음 task가 알아야 할 것
- 변경: `src/points/earn.js`, `src/gift/gift-points.js`, `src/orders/refund.js`, `src/money.js`(`floorPercentOf`)
- 새 테스트 `test/earn.test.js`: 기준 커밋에서 5개 실패, 수정 후 통과
- `src/format/`과 기존 테스트는 바꾸지 않음. 전체 취소(`cancelOrder`)는 저장된 earned 그대로
- 명령: `npm test`
