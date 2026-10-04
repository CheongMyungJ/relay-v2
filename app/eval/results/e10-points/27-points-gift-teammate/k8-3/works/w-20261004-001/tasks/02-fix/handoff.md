---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 배송비를 뺀 결제 금액으로 하고 1P 미만은 버린다"
    why: "기대값 237P를 만드는 유일한 규칙이다 (23,770원의 1% = 237.7, 반올림이면 238P)"
    by: ai
  - what: "percentOf를 바꾸지 않고 earn.js에서만 계산한다"
    why: "percentOf를 쓰는 선물하기 적립(src/gift/gift-points.js)은 수정 금지"
    by: ai
assumptions:
  - "고객센터 규칙은 237P 한 건으로만 추정했다. 배송비 제외와 버림이 다른 주문에서도 같은지는 O-1042 외에 확인하지 못했다"
rejected:
  - "percentOf 자체의 오류: 환불과 선물하기도 쓰는 정상적인 반올림 함수"
  - "쿠폰과 사용 포인트를 기준에서 추가로 빼는 규칙: 237이 나오는 기준이 아니다"
open_questions: []
intent_deviation: null
risks:
  - "환불 회수 포인트(src/orders/refund.js)는 percentOf 반올림이라 적립(버림)과 1P 어긋날 수 있다. 이번 범위 밖이라 두었다"
  - "선물하기 적립(gift-points.js)은 여전히 배송비 포함 반올림이다. 수정 금지라 두었다"
  - "O-1042 외 주문의 고객센터 값으로는 검증하지 못했다"
recommended_next: null
knowledge_candidates:
  - "적립 예정 포인트는 배송비를 뺀 결제 금액의 1%이고 1P 미만은 버린다 (O-1042 237P로 확인, 사람이 준 기대값에서 역산)"
---
## 요약
적립 예정 포인트가 많던 원인은 배송비가 포함된 결제 금액에 반올림을 적용한 것이었다. `earnPoints`를 배송비 제외, 1P 미만 버림으로 고쳐 O-1042가 237P로 나온다. 재현 테스트를 추가했고 `npm test` 23건이 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, 커밋 3fe5284. 테스트: `test/earn.test.js`.
- `src/format/`, `src/gift/gift-points.js`는 변경 없음.
- 환불 회수(`src/orders/refund.js`)와 선물하기 적립은 아직 `percentOf` 반올림이다.
- 확인: `node src/cli.js examples/O-1042.json`
