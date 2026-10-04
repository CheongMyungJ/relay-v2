---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "업무 유형을 bugfix 그대로 진행한다"
    why: "요청은 정책 변경(적립률 1%→2%)이라 유형 불일치를 물었고, 사람이 유지를 택함"
    by: human
  - what: "적립 규정(배송비 제외, 상품−쿠폰−사용 포인트, 1P 미만 버림)을 이번 범위에 넣고, 현재 코드의 배송비 포함·반올림을 고친다"
    why: "사람이 규정은 비율만 바뀐다고 말하고, O-1107이 486P가 나오게 완료조건에 넣으라고 함"
    by: human
  - what: "부분 환불 회수를 새 비율로 맞출지는 이번 범위에서 뺀다"
    why: "사람이 이번 범위가 아니라고 말함"
    by: human
assumptions:
  - "선물하기 주문의 적립도 일반 주문과 같은 규정·계산식을 쓴다고 본다 (팀 지식 earn-rule.md)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "`POINT_RATE_PERCENT`는 `src/orders/refund.js:34`도 쓴다. 상수만 2로 바꾸면 환불 코드를 안 고쳐도 부분 환불 회수 비율이 같이 2%가 된다. 비목표는 환불 코드를 고치지 않는 것이라, fix에서 이 동작 변화를 확인하고 필요하면 사람에게 알려야 함"
  - "적립 규정 수정과 환불 회수는 앞 Work(w-20261004-001, -002)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "부분 환불의 포인트 회수를 새 적립률(2%)로 맞출지는 정해지지 않았다. 적립률 2% 변경 Work에서는 범위 밖으로 둠 (사람)"
---
## 요약
적립률 1%→2% 변경 intent를 고쳤다. 적립 규정(배송비 제외, 버림)을 범위에 넣어 O-1107이 486P가 되는 것을 완료조건으로 명시했고, 환불 회수는 비목표로 뺐다.
## 다음 task가 알아야 할 것
- 적립률: `src/config.js:9`. 사용처: `src/points/earn.js`(일반), `src/gift/gift-points.js`(선물), `src/orders/refund.js:34`(환불 회수, 이번에 고치지 않음).
- 현재 `earnPoints`는 `order.amounts.total`(배송비 포함)에 `percentOf`(반올림)를 쓴다. 고칠 대상.
- O-1107: 상품 27,350, 쿠폰 2,000, 사용 포인트 1,020, 배송비 3,000. 제외·버림 2% = 486P, 포함·반올림 2% = 547P.
- 상수 변경이 환불 회수 비율에 번지는 점은 risks 참고.
- 테스트: `npm test`(20개 통과). `test/receipt.test.js:18`은 영수증 "적립 예정 290P"를 확인한다.
- 참고 지식: `docs/knowledge/points/earn-rule.md`, `docs/knowledge/points/partial-refund-recovery.md`
