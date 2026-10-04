---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 상품−쿠폰−사용 포인트(배송비 제외)로 하고 원 단위 내림으로 한다"
    why: "O-1042 기대값 237P와 맞는 조합이 이것뿐이다 (23,770의 1% = 237.7)"
    by: ai
  - what: "공용 percentOf는 두고 earn.js 안에서만 내림 계산한다"
    why: "percentOf는 선물하기 적립(변경 금지)과 환불 회수도 쓴다"
    by: ai
assumptions:
  - "고객센터 규칙은 O-1042 한 건의 237P로만 추정했다. 배송비 제외, 포인트 차감, 내림은 그 값에서 역산했다."
rejected:
  - "percentOf 수정: 선물하기 적립과 환불이 같이 바뀌어 비목표를 건드린다"
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(src/gift/gift-points.js)은 같은 버그 식(total 반올림)이 남아 있다. 이번 범위에서 뺐다."
  - "부분 환불 회수(src/orders/refund.js:34)는 percentOf 반올림이라 새 적립 규칙과 1P 어긋날 수 있다. 확인하지 않았다."
  - "O-1077, O-1107의 고객센터 값은 모른다. 수정 후 각각 423P(전과 같음), 243P(전 273P)가 나온다."
recommended_next: null
knowledge_candidates:
  - "적립 예정 포인트 기준은 상품 금액−쿠폰−사용 포인트이고 배송비는 뺀다. 1%는 원 단위 내림이다 (고객센터 계산 O-1042 = 237P 기준)"
  - "아직 규칙을 따르지 않음: src/gift/gift-points.js — total 반올림 방식 그대로, 다른 팀과 같이 보는 중이라 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
적립 예정 포인트가 배송비를 포함한 결제 금액의 반올림으로 계산되던 것을 `상품−쿠폰−사용 포인트`의 1% 내림으로 고쳤다. O-1042는 268P에서 237P가 됐고 `npm test` 21개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`. 재현 테스트: `test/order.test.js` 마지막 테스트.
- `src/gift/`, `src/format/`은 변경하지 않았다 (`git diff` 확인).
- 이미 적립된 값은 `order.points.earned`에 저장되며, 이 수정은 주문 생성 때만 계산한다.
- 확인 필요: `src/orders/refund.js:34`의 부분 환불 회수와 반올림 규칙이 다르다.
