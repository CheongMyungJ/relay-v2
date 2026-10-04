---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반올림 함수 percentOf는 두고 버림 함수 floorPercentOf를 새로 추가했다"
    why: "percentOf를 선물하기(gift-points.js)도 쓰는데 선물하기는 이번 범위에서 뺐다"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(gift-points.js)은 기존 방식(배송비 포함, 반올림) 그대로라 일반 주문과 차이가 난다(범위에서 뺌)"
  - "이미 저장된 주문의 points.earned는 바뀌지 않는다"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립 기준은 상품 금액 − 쿠폰 할인 − 사용 포인트(배송비 제외), 소수점 버림 (사람)"
---
## 요약
적립 계산이 배송비를 포함하고 반올림하던 것을 고쳤다. O-1042는 268P에서 237P가 된다. 재현 테스트 3건을 추가했고 `npm test` 23건이 통과한다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: 기준 금액 `goods - coupon - pointsUsed`, `floorPercentOf` 사용
- `src/money.js`: `floorPercentOf` 추가
- `test/earn.test.js`: 새 테스트
- `src/gift/gift-points.js:6`은 그대로 `percentOf(total)` 사용
