---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "여러 번 나눈 환불은 이전 환불에서 이미 회수한 만큼을 빼고 회수한다 (이전 남은 상품 재계산 − 현재 재계산)"
    why: "intent가 '같은 기준'만 말하고 이중 회수 여부는 정하지 않음. 합계가 원 적립 − 최종 재계산과 같아지게 함"
    by: ai
  - what: "earnPoints, 선물하기, cancelOrder는 건드리지 않고 refund.js에서만 버림 계산"
    why: "비목표(전체 취소·선물하기 제외). earnPoints 규칙 수정은 앞 Work에서 머지 대기"
    by: ai
assumptions:
  - "이전 환불의 회수 포인트도 같은 규칙으로 계산됐다고 본다(저장값을 읽지 않음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 earnPoints를 고쳤을 수 있음, 머지 대기. 머지 후 earnPoints 변경과 충돌 가능"
  - "나눠 한 환불 테스트는 수정 전에도 통과해 회귀 방지력이 약함"
  - "알려지지 않은 이전 환불이 옛 방식(반올림)으로 회수됐다면 합계가 1P 어긋날 수 있음"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 이전 환불 반영 적립(첫 환불은 주문 저장 적립) − floor((남은 상품 − 쿠폰 − 사용 포인트) × 적립률). 구현 src/orders/refund.js (사람)"
---
## 요약
`createRefund`의 회수 포인트를 원 적립 − 남은 상품 재계산 적립(버림)으로 고쳤다. R-0311은 132P, 환불 금액 13,130원 그대로. `npm test` 22개 통과.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` `earnedFor`/`pointsBefore`, `src/money.js` `floorPercentOf`
- 테스트: `test/refund.test.js` 하단 2개
- 영수증(`src/format/`)은 변경 없음
