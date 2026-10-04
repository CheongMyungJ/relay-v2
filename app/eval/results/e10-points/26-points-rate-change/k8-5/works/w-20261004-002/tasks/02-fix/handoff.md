---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트가 음수가 되지 않도록 0 아래로는 내리지 않는다"
    why: "intake가 음수 회수 가능성을 확인 안 한 채로 남김. 포인트를 되돌려 주는 쪽은 의도에 없음"
    by: ai
  - what: "버림 계산은 `money.js`에 `floorPercentOf`를 새로 추가하고 `percentOf`는 바꾸지 않는다"
    why: "`percentOf`는 `earnPoints` 등 범위 밖 코드가 쓴다 (비목표). 제약: docs/knowledge/points/earn-rule.md 버림 기준"
    by: ai
assumptions:
  - "남은 상품 금액은 이전 부분 환불(alreadyRefunded)까지 뺀 값이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 주문에 부분 환불이 여러 번이면 '저장된 적립 − 남은 적립'이 이전 환불에서 회수한 몫을 포함해 중복 회수될 수 있다. 입력에 이전 회수 포인트가 없어 의도 식 그대로 구현했다. 이 경우는 테스트하지 않음"
  - "`earnPoints`(`src/points/earn.js`)와 `percentOf`는 아직 반올림이다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 저장된 적립 − (남은 상품 − 쿠폰 − 사용 포인트)의 1% 버림. `src/orders/refund.js`에 구현, 음수는 0으로 막음. 여러 번 부분 환불 시 이전 회수분 처리는 미정"
---
## 요약
`createRefund`의 회수 포인트를 환불분 1% 반올림에서 '저장된 적립 − 남은 상품 기준 적립(버림)'으로 고쳤다. O-1077/R-0311은 132P, 환불 금액은 13,130원 그대로다. 재현 테스트 추가, `npm test` 21개 통과.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` 회수 계산 부분과 `src/money.js` `floorPercentOf`
- 새 테스트: `test/refund.test.js` 마지막 테스트. 기존 테스트는 그대로 통과
- `src/format/` 변경 없음
- 다회 부분 환불 중복 회수 가능성은 risks 참고
