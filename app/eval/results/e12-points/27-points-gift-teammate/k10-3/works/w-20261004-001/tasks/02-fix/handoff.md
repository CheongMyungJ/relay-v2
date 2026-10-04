---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 배송비를 뺀 금액(상품-쿠폰-사용 포인트)으로 하고 1P 미만은 버린다"
    why: "intent의 기대값 237P를 만족하는 유일한 규칙(반올림이면 238P). 규칙이 요청 값으로 정해져 따로 묻지 않음"
    by: ai
  - what: "공용 percentOf는 바꾸지 않고 earn.js에서만 버림 계산"
    why: "percentOf는 다른 계산에서도 반올림으로 쓰임. 범위 최소화"
    by: ai
assumptions:
  - "고객센터 규칙이 배송비 제외+버림이라는 것은 237P 한 건과 요청 설명으로 추론했다. 다른 규정 문서는 확인하지 못했다"
rejected:
  - "반올림 유지: O-1042가 238P가 되어 기대값과 다름"
  - "사용 포인트를 기준에 포함: 23,770이 아니라 25,270이 되어 253P"
open_questions: []
intent_deviation: null
risks:
  - "src/gift/gift-points.js도 같은 방식(배송비 포함, 반올림)이라 선물 적립은 여전히 다르게 나온다. 비목표라 손대지 않음"
  - "이미 저장된 points.earned는 재계산하지 않으므로 기존 주문 값은 그대로다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트 기준: 배송비를 뺀 결제 금액(상품-쿠폰-사용 포인트)의 1%, 1P 미만 버림. 고객센터 계산 기준(237P, O-1042)"
  - "정하지 않음: 선물하기 적립(src/gift/gift-points.js)에 같은 기준을 적용할지 — 이번 범위에서 뺌, 지금 코드는 배송비 포함+반올림 (사람)"
---
## 요약
적립 기준에서 배송비를 빼고 1P 미만을 버리도록 `earnPoints`를 고쳤다. O-1042는 268P에서 237P, O-1107은 273P에서 243P가 되고 O-1077은 423P 그대로다. 회귀 테스트 2개를 추가했고 `npm test` 22개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js` (커밋 1e3f68a)
- 테스트: `test/order.test.js` 끝의 2개 (수정 전 실패 확인함)
- `src/format/`, `src/gift/gift-points.js`는 변경 없음
- 선물 적립은 같은 문제가 남아 있음(비목표)
