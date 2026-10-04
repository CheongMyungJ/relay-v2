---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "업무 유형은 사람이 고른 bugfix로 둔다. 요청은 정책값 변경이지만 O-1107의 기대값 486P가 현재 코드 계산과 달라 계산 기준 어긋남도 함께 다루는 것으로 본다"
  - "선물하기 적립도 상수를 따라 2%로 오른다고 가정했다 (사람이 모름이라 답함)"
  - "486P는 팀 지식의 적립 기준(상품 − 쿠폰 − 사용 포인트, 배송비 제외, 버림)으로 맞춰진다고 봤다"
rejected: []
open_questions:
  - "선물하기(G-) 적립도 2%로 올릴까요? 초안은 2%로 썼다. 1% 유지면 선물 전용 상수를 분리해야 한다"
intent_deviation: null
risks:
  - "이 브랜치의 earnPoints는 아직 옛 기준(결제 금액 total, 반올림, 배송비 포함)이라 앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기. 머지 시 같은 파일이 겹칠 수 있다"
  - "src/orders/refund.js의 부분 환불 회수도 옛 방식(환불 상품 금액의 %)이다. 앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기"
  - "test/gift.test.js(기대값 300)와 test/order.test.js(기대값 500) 등 1% 전제 테스트 기대값이 바뀐다"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 선물하기 적립률을 일반 적립률과 같이 올릴지 — 사람이 모른다고 답함, 지금 코드는 공유 상수 POINT_RATE_PERCENT를 따름 (사람)"
---
## 요약
기본 적립률을 1%에서 2%로 올리는 의도 초안을 썼다. 저장된 적립은 다시 계산하지 않고 영수증 글자는 건드리지 않는다. O-1107은 486P가 되어야 한다.
## 다음 task가 알아야 할 것
- 참고 지식: `docs/knowledge/points/earn-basis.md` (기준 브랜치에는 아직 없음)
- 적립률 상수: `src/config.js:9`. 사용처는 `src/points/earn.js:6`, `src/orders/refund.js:34`, `src/gift/gift-points.js:6`
- `src/money.js`의 `percentOf`는 반올림이다. 규칙은 버림
- O-1107: 현재 코드는 total 27,330 × 2% 반올림 = 547. 규칙 기준은 24,330 × 2% 버림 = 486
- 1% 전제 테스트: `test/order.test.js:26`, `test/gift.test.js:14`, `test/refund.test.js:20`
- 테스트 명령: `npm test` (현재 20개 통과)
