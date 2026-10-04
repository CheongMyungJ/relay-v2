---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트가 음수가 되지 않도록 0으로 하한을 둔다"
    why: "저장된 적립이 옛 기준(결제 금액)이면 재계산 적립이 더 클 수 있어, 음수 회수를 막으려는 방어"
    by: ai
  - what: "회수 포인트 규칙(원래 적립 − 남은 상품 기준 재계산 적립, 버림)과 배송비 제외 기준을 따른다"
    why: "intent와 docs/knowledge/point-earn-base-excludes-shipping.md"
    by: ai
assumptions:
  - "alreadyRefunded가 있으면 남은 상품 금액은 이전 환불분까지 뺀 기존 remainingGoods를 쓴다"
rejected: []
open_questions: []
intent_deviation:
  summary: "완료조건 '영수증 출력이 수정 전과 같다'는 회수 포인트 줄에서 필연적으로 달라진다 (-131P → -132P)"
  evidence: "수정 전 `node src/cli.js examples/R-0311.json --order examples/O-1077.json`은 -131P, 수정 후 -132P. 환불 금액 13,130원과 `src/format/` 코드는 그대로"
risks:
  - "회수 포인트 줄의 영수증 값이 바뀌므로 완료조건 6번 해석을 verify에서 확인해야 함"
  - "저장된 earned가 옛 기준이면 재계산 적립이 더 커서 0으로 잘릴 수 있음"
  - "앞 Work(w-20261004-001)에서 적립 계산(src/points/earn.js)이 이미 고쳐졌을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "부분 환불의 회수 포인트는 '저장된 원래 적립 − 남은 상품 기준 재계산 적립(상품−쿠폰−사용 포인트의 1% 버림, 배송비 제외)'이다. 환불 상품 금액의 1% 반올림은 틀리다 (사람)"
---
## 요약
`createRefund`의 회수 포인트를 환불 상품의 1% 반올림에서 '원래 적립 − 남은 상품 재계산 적립(버림)'으로 고쳤다. O-1077/R-0311은 131P에서 132P가 됐다. 테스트 2개를 추가했고 `npm test`는 22개 통과한다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` createRefund 끝부분 `earnedLeft`와 `pointsRecovered`; `src/money.js` `floorPercentOf`
- 테스트: `test/refund.test.js` 끝의 2개. 수정 전에는 2개가 실패했다.
- `refundAmount`는 13,130원 그대로. 영수증 회수 줄만 -132P로 바뀐다 (intent_deviation 참고).
- 기존 테스트는 변경하지 않았다.
