---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "기대 값 218P는 일반 주문 규칙(src/points/earn.js)을 G-0213에 적용해 얻은 값이다. 요청 원문에 값이 적혀 있지 않다"
  - "일반 주문과 같은 값이 되는 것을 올바른 동작으로 본다(요청의 '일반 주문과 다르다'는 문의 기준)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이미 적립된 선물 주문은 다시 계산하지 않으므로, 과거 주문의 적립 차이는 이 일에서 다루지 않는다"
recommended_next: null
knowledge_candidates:
  - "이미 적립된 포인트는 다시 계산하지 않는다 (사람)"
---
## 요약
G-0213의 적립 예정 포인트가 일반 주문과 다른 문제를 bugfix로 정리했다. 선물 메시지·받는 사람·영수증 글자 변경 금지와 기적립분 재계산 금지를 비목표로 두었다.
## 다음 task가 알아야 할 것
- 참고용 가설(intent에는 없음): `src/gift/gift-points.js`는 `percentOf(order.amounts.total, ...)`로 배송비를 빼지 않고 반올림한다. 일반 주문 `src/points/earn.js`는 배송비를 빼고 내림한다. 커밋 5ff61ae가 earn.js만 고친 것으로 보인다.
- G-0213 금액: 상품 24,860 − 쿠폰 2,000, 배송비 3,000, 포인트 1,000 사용 → total 24,860. 현재 249P, 일반 규칙이면 218P.
- 테스트: `npm test`(`node --test`), `test/gift.test.js`, `test/earn.test.js`.
