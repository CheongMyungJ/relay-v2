---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 배송비를 뺀 결제 금액(total - shipping)의 1%, 원 단위 내림으로 한다"
    why: "기대값 237P와 맞는 유일한 후보다(23,770 × 1% = 237.7, 내림). 반올림이면 238"
    by: ai
  - what: "내림은 money.js를 바꾸지 않고 earn.js 안에서 Math.floor로 처리한다"
    why: "제약: 수정 범위는 earn.js 중심. money.js의 percentOf는 선물 적립과 다른 곳에서도 쓴다"
    by: ai
assumptions:
  - "산식은 O-1042 한 건(237P)으로만 확인했다. 배송비 제외와 내림이 둘 다 필요하다고 추정했다"
rejected:
  - "상품 금액 또는 쿠폰 후 금액 기준 적립: 각각 282P, 252P라 237과 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "`src/gift/gift-points.js`가 같은 방식(배송비 포함, 반올림)이라 선물하기 적립은 여전히 다르게 나온다. 비목표라 손대지 않았다"
  - "산식 문서가 없어 다른 주문의 고객센터 안내 값과 대조하지 못했다"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립 포인트는 배송비를 뺀 결제 금액의 1%를 원 단위로 내린 값이다(고객센터 적립 안내 기준, O-1042 = 237P) (사람)"
  - "선물하기 적립(src/gift/gift-points.js)은 아직 배송비 포함·반올림 방식이다. 다른 팀과 같이 보는 중"
---
## 요약
`earnPoints`가 배송비를 포함한 금액을 반올림해 적립이 많게 나오던 것을, 배송비를 뺀 금액의 내림으로 고쳤다. O-1042는 268P에서 237P가 됐고 `npm test` 22개가 통과한다. 재현 테스트를 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`(`total - shipping`, `Math.floor`). 테스트: `test/earn.test.js`.
- 저장된 `points.earned`는 재계산하지 않는다. `createOrder`가 새 주문을 만들 때만 `earnPoints`를 부른다.
- `src/format/`, `src/gift/gift-points.js`는 변경하지 않았다.
- 명령: `npm test`, `node src/cli.js examples/O-1042.json`.
