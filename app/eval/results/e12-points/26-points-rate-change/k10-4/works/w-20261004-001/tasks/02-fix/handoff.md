---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 회수는 환불 상품 금액의 1%를 버림으로 계산하고, 쿠폰·사용 포인트는 안분하지 않는다"
    why: "refund.js의 기존 설계가 쿠폰과 사용 포인트를 남은 주문에 그대로 두므로 그 설계를 유지하고 반올림만 버림으로 바꿨다"
    by: ai
  - what: "percentOf는 그대로 두고 percentOfFloor를 새로 추가"
    why: "기존 함수의 동작을 바꾸지 않아 영향 범위를 줄이기 위해"
    by: ai
assumptions:
  - "G-0213의 올바른 값은 규정대로 (24,860 − 2,000 − 1,000)의 1% 버림인 218P로 봄. 사람이 값을 확인하지는 않음"
rejected:
  - "percentOf를 Math.floor로만 바꾸기: 배송비가 total에 남아 O-1042가 267P가 되어 규정과 다름"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수액이 쿠폰·사용 포인트를 반영하지 않아, 환불 상품 금액이 크면 회수 합계가 처음 적립보다 많아질 수 있음. 규정이 없어 기존 방식을 유지함"
  - "이미 저장된 적립 값은 재계산하지 않음(비목표)"
recommended_next: null
knowledge_candidates:
  - "적립 규정: (상품 금액 − 쿠폰 − 사용 포인트)의 1%, 1P 미만 버림, 배송비 제외. 일반·선물·환불 회수 모두 같은 기준 (사람)"
  - "정하지 않음: 부분 환불 시 쿠폰·사용 포인트 안분 방식 — 규정이 없고, 지금 코드는 환불 상품 금액의 1%를 버림으로 회수"
---
## 요약
적립이 배송비 포함 금액을 반올림하던 것을 (상품 − 쿠폰 − 사용 포인트)의 1% 버림으로 고쳤다. O-1042는 237P, G-0213은 218P가 된다. 환불 회수도 버림을 적용했다. `npm test` 25개 모두 통과했다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `earnBase`와 `earnPoints`. `src/gift/gift-points.js`는 이것에 위임한다.
- `src/money.js`: `percentOfFloor` 추가. `percentOf`는 이제 쓰는 곳이 없지만 남겨 두었다.
- `src/orders/refund.js:34`: 회수는 환불 상품 금액 기준이고 버림이다. R-0311은 수정 전후 모두 131P다.
- 새 테스트: `test/points-earn.test.js` (수정 전 4개 실패, 수정 후 통과)
- 확인 명령: `node src/cli.js examples/O-1042.json`
