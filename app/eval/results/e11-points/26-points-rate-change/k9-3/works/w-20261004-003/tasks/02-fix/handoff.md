---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "이 브랜치에서 적립 기준(배송비 제외, 1P 미만 버림)도 함께 구현한다 (earnFromAmounts)"
    why: "사람이 답함: 적립 규정은 원래 그 기준이고 바뀌는 건 비율뿐이며, 앞 Work 머지 여부를 알 수 없으니 이 브랜치에서 O-1107이 486P가 나와야 한다"
    by: human
  - what: "환불 회수율을 별도 상수 REFUND_RECOVER_RATE_PERCENT = 1로 분리하고 계산식은 그대로 둔다"
    why: "환불 회수는 변경 전과 같아야 한다는 완료조건. 상수만 바꾸면 회수도 2%가 된다"
    by: ai
  - what: "test/order.test.js, test/gift.test.js의 적립 기대값을 1%에서 2% 값으로 고친다"
    why: "적립률 변경의 직접 결과. 입력은 그대로 두었다"
    by: ai
assumptions: []
rejected:
  - "비율 상수만 2%로 변경: O-1107이 547P가 되어 목표와 다르고 환불 회수도 2%가 된다"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001, -002)에서 같은 earnFromAmounts를 고쳤을 수 있음, 머지 대기. 함수 시그니처가 다르면 머지 때 충돌한다 (이 브랜치는 earnFromAmounts({goods, coupon, pointsUsed}))"
  - "기존 테스트 2건(order, gift)의 적립 기대값을 바꿨다. 입력은 같고 값은 2%에 맞췄다"
  - "환불 회수 계산은 기존 반올림 방식 그대로라 앞 Work의 회수 규칙(저장값 − 남은 상품 적립)과 다르다. 이번 범위에서 뺌"
recommended_next: null
knowledge_candidates:
  - "2026-10-04 기본 적립률을 1%에서 2%로 올림. 적립 기준은 그대로이고 비율만 바뀜. 환불 회수율은 1% 유지, 새 비율 적용 여부는 정산팀과 따로 정함 (사람)"
  - "아직 규칙을 따르지 않음: src/orders/refund.js — 환불 회수가 REFUND_RECOVER_RATE_PERCENT(1%)를 쓴다, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
적립을 `earnFromAmounts`(상품 − 쿠폰 − 사용 포인트, 배송비 제외, 버림) × 2%로 바꿨다. O-1107은 486P(기준 커밋 273P). 선물하기도 같은 함수를 쓴다. 환불 회수는 별도 상수 1%로 분리해 그대로 두었다.
## 다음 task가 알아야 할 것
- `src/config.js`: `POINT_RATE_PERCENT = 2`, `REFUND_RECOVER_RATE_PERCENT = 1`
- `src/points/earn.js`: `earnFromAmounts`
- 재현 테스트 `test/earn-rate.test.js`. `npm test` 24개 통과
- 기존 테스트 변경: `test/order.test.js` 500→1000, `test/gift.test.js` 300→600
- `src/format/`은 안 바뀜. 저장된 `points.earned` 재계산 코드는 없음
