---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 배송비를 뺀 금액으로 하고 1P 미만은 버린다"
    why: "O-1042의 기대값 237P가 이 계산(23770×1%=237.7 버림)과 맞는 유일한 식이다. 비목표 때문에 공유하는 percentOf는 바꾸지 않고 earn.js에서만 처리했다"
    by: ai
assumptions:
  - "고객센터의 237P가 정답이고 계산식은 거꾸로 맞춘 것이다. 정책 문서로 확인하지 않았다"
  - "O-1077=423, O-1107=243은 같은 식으로 계산한 값이며 고객센터 값으로 확인하지 않았다"
rejected:
  - "쿠폰 전 상품 금액 기준: 28270의 1%는 283이라 237과 안 맞는다"
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(src/gift/gift-points.js)은 같은 식(배송비 포함, 반올림)이라 같은 과다 적립이 있을 수 있다. 비목표라 손대지 않았다"
  - "버림 규칙은 237P 하나로 추정했다. 다른 주문의 정답으로 검증되지 않았다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 배송비를 뺀 결제 금액의 1%를 버림한 값이다 (고객센터 기준 O-1042=237P)"
  - "선물하기 적립(gift-points.js)은 earn.js와 같은 옛 식을 쓴다. 다른 팀과 협의 전에는 바꾸지 않는다"
---
## 요약
적립 예정 포인트가 배송비 포함 금액에 반올림으로 계산되던 것을 배송비 제외, 버림으로 고쳤다. O-1042는 268P에서 237P가 됐다. 재현 테스트를 추가했고 `npm test` 24개가 통과한다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: 수정한 계산식
- `test/earn.test.js`: 새 테스트 (O-1042=237, O-1077=423, O-1107=243)
- `src/gift/gift-points.js`, `src/format/`, `src/money.js`는 변경하지 않았다.
- 기존 테스트는 변경하지 않았다.
- 저장된 `points.earned`를 다시 계산하는 코드는 추가하지 않았다. 주문 생성 시점에만 계산한다.
