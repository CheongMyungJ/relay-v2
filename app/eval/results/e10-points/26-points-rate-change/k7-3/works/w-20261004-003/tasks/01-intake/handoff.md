---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "업무 유형은 선택한 버그 수정(bugfix) 그대로 진행한다"
    why: "정책 변경이라 유형이 어긋나 보인다고 물었고, 사람이 그대로 진행을 골랐다"
    by: human
  - what: "O-1107 기대값 486P를 배송비 제외·버림 기준 계산으로 해석해 완료조건에 넣었다"
    why: "(27,350 - 2,000 - 1,020) × 2% = 486.6 → 486. 팀 지식 points-earn-basis와 일치한다"
    by: ai
assumptions:
  - "요청의 '기본 적립률'은 `POINT_RATE_PERCENT` 상수 하나를 뜻한다고 보았다"
  - "O-1107의 배송비는 3,000원이다(쿠폰 뺀 상품 금액 25,350원 < 30,000원). 총 결제 27,330원"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 이 브랜치의 `src/points/earn.js:6`은 아직 옛 식(배송비 포함, 반올림)이다. 이번 Work에서 486P를 내려면 기준도 맞춰야 하고, 머지 시 충돌할 수 있다"
  - "`POINT_RATE_PERCENT`를 `src/gift/gift-points.js:6`과 `src/orders/refund.js:34`도 쓴다. 상수만 바꾸면 선물하기 적립과 환불 회수식도 2%로 바뀐다. 앞 Work(w-20261004-002)에서 환불을 고쳤을 수 있음, 머지 대기"
  - "`percentOf`(`src/money.js`)는 반올림이라 다른 곳에서도 쓰인다. 건드리면 영향이 퍼진다"
recommended_next: null
knowledge_candidates: []
---
## 요약
적립률을 1%에서 2%로 올리는 요청의 의도 초안을 썼다. 저장된 적립값과 영수증 글자는 그대로 두고, O-1107이 486P가 되는 것을 완료조건으로 했다.
## 다음 task가 알아야 할 것
- `src/config.js:9`: `POINT_RATE_PERCENT = 1`. 사용처는 `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`.
- 이 브랜치의 `earnPoints`는 `percentOf(amounts.total, rate)`로 배송비 포함·반올림이다. 율만 2%로 바꾸면 O-1107이 547P다. 목표 486P는 (total - shipping)에 2%, 버림.
- `src/money.js` `percentOf`는 `Math.round`.
- 참고 팀 지식: `docs/knowledge/points-earn-basis.md`, `docs/knowledge/refund-recovery-vs-earn-basis.md`(둘 다 기준 브랜치에 아직 없음).
- 테스트: `npm test`(`node --test`), `test/receipt.test.js`, `test/refund.test.js`, `test/order.test.js`.
