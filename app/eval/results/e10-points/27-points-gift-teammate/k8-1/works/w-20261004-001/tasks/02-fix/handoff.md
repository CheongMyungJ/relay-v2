---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 상품-쿠폰-사용 포인트(배송비 제외)로 하고 1P 미만은 버림으로 한다"
    why: "완료조건의 O-1042=237P를 만족하는 기준은 이것뿐이다 (반올림이면 238P)"
    by: ai
assumptions:
  - "적립 안내의 기준이 O-1042 한 건에서 역산한 것과 같다고 가정했다 (기준 문서 없음)"
rejected:
  - "상품-쿠폰 금액 기준: 253P라 237P와 맞지 않음"
  - "결제 금액 기준에서 반올림만 바꾸기: 268P라 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(`src/gift/gift-points.js`)은 비목표라 그대로 두었다. 배송비를 포함하고 반올림해서 일반 주문과 기준이 달라졌다 (G-0213은 249P 그대로)"
  - "O-1107 같은 다른 주문의 적립 안내 기대값은 확인하지 못했다 (273P에서 243P로 바뀜)"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립은 배송비를 뺀 금액(상품-쿠폰-사용 포인트)의 1%를 1P 미만 버림으로 계산한다 (`src/points/earn.js`)"
  - "선물하기 적립(`src/gift/gift-points.js`)은 아직 배송비 포함·반올림이라 일반 주문과 다르다. 다른 팀과 함께 볼 일이다"
---
## 요약
`earnPoints`가 배송비가 든 결제 금액에 반올림으로 적립률을 곱해서 268P가 나왔다. 배송비를 뺀 금액에 버림으로 고쳐 O-1042가 237P가 된다. 재현 테스트를 추가했고 `npm test` 22개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js` (`total - shipping`, `Math.floor`). 테스트: `test/earn.test.js`.
- 저장된 `points.earned`는 건드리지 않았다 (`createOrder`에서 새로 만들 때만 계산).
- `src/format/`, `src/gift/`는 변경 없음. 선물하기 적립은 기준이 달라졌다.
- 결과: O-1042 237P, O-1107 243P, G-0213 249P(변경 없음).
