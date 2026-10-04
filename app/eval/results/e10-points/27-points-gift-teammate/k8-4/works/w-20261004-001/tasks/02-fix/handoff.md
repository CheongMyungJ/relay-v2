---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "`percentOf`는 두고 `earnPoints`에서만 버림 계산을 한다"
    why: "선물하기 적립과 환불도 `percentOf`를 쓰고 선물은 비목표"
    by: ai
assumptions:
  - "O-1077(423P), O-1107(243P)도 같은 기준이 맞다고 가정 (확인 안 됨)"
rejected:
  - "`percentOf`를 버림으로 변경: gift-points, refund에 영향"
open_questions: []
intent_deviation: null
risks:
  - "환불의 `pointsRecovered`는 여전히 `percentOf(refundGoods)` 반올림이라 적립 규칙과 다를 수 있음(이번 범위 밖)"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립 포인트는 배송비 제외, 사용 포인트 차감 후 금액의 1%를 소수점 버림한다 (사람)"
  - "`percentOf`(src/money.js)는 반올림이며 선물 적립과 환불 회수 포인트도 쓴다. 바꾸면 함께 바뀐다"
---
## 요약
`earnPoints`가 배송비 포함 금액을 반올림하던 것을 (상품−쿠폰−사용 포인트) 1% 버림으로 고쳤다. O-1042는 237P가 된다. 테스트 3개 추가, `npm test` 23개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js` 6행 부근, 테스트: `test/earn.test.js`
- 예시 결과: O-1042 237, O-1077 423, O-1107 243
- `src/format/`, `src/gift/` 변경 없음, 기존 테스트 변경 없음
- 환불 `src/orders/refund.js:34`는 반올림 그대로
