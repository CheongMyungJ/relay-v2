---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 회수는 별도 상수 REFUND_RECOVERY_RATE_PERCENT = 1로 변경 전 계산을 유지한다"
    why: "비목표: 환불 회수에 새 비율 적용 여부는 정산팀과 따로 정함. 상수를 공유하면 함께 바뀜"
    by: ai
  - what: "적립 기준을 배송비 제외·원 단위 버림으로 바꾼다 (일반·선물 모두)"
    why: "intent 제약과 docs/knowledge/points/earn-points-basis.md"
    by: ai
  - what: "기존 테스트 2건의 적립 기대값을 2% 기준으로 바꾼다"
    why: "적립률 변경이 요청의 목적이라 옛 1% 값이 맞지 않게 됨"
    by: ai
assumptions:
  - "저장된 주문은 order.points.earned를 그대로 쓰므로 코드 변경으로 다시 계산되지 않는다 (cancelOrder, receiptLines 확인)"
rejected:
  - "상수만 1에서 2로 변경: 배송비 포함·반올림이라 O-1107이 547P가 되고 환불 회수도 바뀜"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 변경: test/order.test.js(500→1000), test/gift.test.js(300→600). 약화 여부는 verify가 판단"
  - "앞 Work(w-20261004-001, -002)에서 earn 기준과 refund 회수 방식을 고쳤을 수 있음, 머지 대기. 머지 시 earn.js와 refund.js에서 충돌 가능"
  - "O-1042 예시 파일에는 저장된 적립 값이 없어 '저장값 그대로 사용'은 코드 읽기로만 확인함"
recommended_next: null
knowledge_candidates:
  - "적립률은 2026-10-04 배포부터 2%다. 환불 회수 비율은 정산팀과 따로 정하기로 해 src/config.js의 REFUND_RECOVERY_RATE_PERCENT(1)로 분리해 둠 (사람)"
  - "아직 규칙을 따르지 않음: src/orders/refund.js — 회수에 새 적립률을 쓸지는 정산팀과 따로 정함, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
적립률을 2%로 올리고 적립 기준을 배송비 제외·버림으로 맞췄다. O-1107은 486P, 선물하기도 같은 규칙이다. 환불 회수는 별도 상수(1%)로 분리해 변경 전과 같다. `npm test` 23건 통과.
## 다음 task가 알아야 할 것
- 변경: `src/points/earn.js`, `src/gift/gift-points.js`, `src/config.js:9-11`, `src/orders/refund.js:34`.
- 재현 테스트: `test/earn-rate.test.js`. 수정 전 2건 실패, 수정 후 통과.
- 기존 테스트 변경 2건(order, gift)은 기대값만 2배.
- `src/format/`은 건드리지 않았다.
