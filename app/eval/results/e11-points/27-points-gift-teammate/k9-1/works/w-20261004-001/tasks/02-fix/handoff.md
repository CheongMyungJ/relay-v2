---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 (상품 − 쿠폰 − 사용 포인트), 즉 배송비 제외 금액의 1% 버림으로 한다"
    why: "기대값 237P(23,770원 × 1% = 237.7)를 만족하는 기준은 이것뿐이다"
    by: ai
  - what: "money.js의 percentOf는 바꾸지 않고 earn.js 안에서만 버림한다"
    why: "환불 회수와 선물하기 적립이 같은 함수를 써서 범위 밖 동작이 바뀐다"
    by: ai
assumptions:
  - "고객센터 계산식은 문서가 없어 237P에서 역산했다(배송비 제외, 버림)"
rejected:
  - "반올림만 버림으로 변경: total 기준이면 267P라 237P가 안 된다"
open_questions: []
intent_deviation: null
risks:
  - "역산한 기준이 고객센터 규칙과 다를 수 있다. O-1042 한 건으로 배송비 제외와 버림을 함께 추정했다"
  - "선물하기 적립(src/gift/gift-points.js)은 같은 과다 적립 문제가 있을 수 있으나 범위 밖이라 그대로 뒀다"
  - "환불 회수(refund.js)는 상품 금액의 1%를 반올림해서 새 적립 기준과 어긋날 수 있다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트 기준: (상품 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 원 단위 버림. src/points/earn.js (고객센터 계산 기준, 역산)"
  - "아직 규칙을 따르지 않음: src/gift/gift-points.js — 결제 금액 1% 반올림, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
적립 예정 포인트가 배송비 포함 결제 금액을 반올림해서 많게 나왔다. 배송비를 뺀 금액 기준으로 버림하게 고쳐 O-1042가 237P가 된다. 회귀 테스트를 추가했고 `npm test` 24개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`의 `earnPoints`. 테스트: `test/earn.test.js`.
- 확인: `node src/cli.js examples/O-1042.json`에서 적립 예정 237P.
- `src/format/`과 `src/gift/`는 변경하지 않았다.
- 환불 회수(`src/orders/refund.js:34`)와 선물하기 적립은 옛 기준(반올림)이 남아 있다.
