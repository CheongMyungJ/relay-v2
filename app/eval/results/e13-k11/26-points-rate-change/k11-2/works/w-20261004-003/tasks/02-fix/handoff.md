---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 회수와 선물하기 적립은 옛 1%를 쓰는 별도 상수로 분리"
    why: "intent 비목표와 완료조건: 둘의 결과는 변경 전과 같아야 한다"
    by: ai
  - what: "earnPoints를 (상품 - 쿠폰 - 사용 포인트) 내림으로 고침"
    why: "docs/knowledge/points/earn-rule.md 규칙과 intent 제약"
    by: ai
assumptions: []
rejected:
  - "상수만 2로 바꾸기: 배송비 포함·반올림으로 O-1107이 547P, 환불·선물하기도 2%가 됨"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 test/order.test.js의 적립 기대값 500을 1000으로 바꿈(비율 변경의 결과). 약화 여부는 verify가 판단"
  - "이 브랜치에는 앞 Work(w-20261004-001/002)의 earn.js·refund.js 수정이 없어 머지 시 충돌 가능. 앞 Work에서 고쳤을 수 있음, 머지 대기"
  - "환불 회수는 지금 1% 반올림 방식(환불 상품 금액의 %)이라 2% 주문과 어긋날 수 있음. 정산팀 결정 대기"
recommended_next: null
knowledge_candidates:
  - "2026-10 기본 적립률을 1%에서 2%로 올림. 적립 규정은 비율만 바뀐다 (사람)"
  - "정하지 않음: 환불 회수에 새 적립률 적용 — 사람이 \"정산팀과 따로 정한다\"고 함, 정산팀과 사람이 정함, 지금 코드는 `REFUND_RECOVER_RATE_PERCENT = 1` (사람)"
  - "정하지 않음: 선물하기 적립률 — 사람이 \"2%로 올릴지는 따로 정한다\"고 함, 사람이 정함, 지금 코드는 `GIFT_POINT_RATE_PERCENT = 1` (사람)"
---
## 요약
O-1107이 273P로 나오던 것을 486P로 고쳤다. 적립을 규정대로(배송비 제외, 내림) 2%로 계산하고, 환불 회수·선물하기는 1% 상수로 분리해 결과를 그대로 뒀다. `npm test` 21건 통과.
## 다음 task가 알아야 할 것
- `src/config.js`: `POINT_RATE_PERCENT=2`, `REFUND_RECOVER_RATE_PERCENT=1`, `GIFT_POINT_RATE_PERCENT=1`
- `src/points/earn.js`: 적립 계산. `src/format/`은 건드리지 않음
- 테스트: `npm test`. 수정 전 코드에서는 새 O-1107 테스트 등 2건 실패
