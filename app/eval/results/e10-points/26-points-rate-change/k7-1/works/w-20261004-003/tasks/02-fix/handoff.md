---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 (상품 − 쿠폰 − 사용 포인트) 버림으로 earnOn 한 곳에 두고, 주문·선물이 이를 쓴다"
    why: "O-1107이 486P가 되려면 필요하고, 팀 지식 points-earn-excludes-shipping-floor.md가 정한 규칙이다"
    by: ai
  - what: "부분 환불 회수는 바꾸지 않고 기존 1%를 별도 상수 REFUND_RECOVERY_RATE_PERCENT로 유지한다"
    why: "사람 지시: 환불 회수의 새 비율은 정산팀과 따로 정한다. 적립률 상수가 2가 되면 회수가 따라 바뀌므로 분리했다"
    by: human
assumptions:
  - "1% 기준 기존 적립 테스트(order, gift)의 기댓값은 2% 기준으로 바꾸는 것이 의도다"
rejected:
  - "상수만 2로 변경: 배송비 포함 반올림이라 547P가 나와 486P를 못 맞춘다"
  - "환불 회수 로직을 새 비율·저장값 기준으로 변경: 사람이 이번 범위가 아니라고 함"
open_questions: []
intent_deviation:
  summary: "비목표는 적립 기준 금액 계산을 바꾸지 않는다고 했으나, 이 브랜치의 기준(배송비 포함·반올림)으로는 486P가 불가능해 적립 기준도 함께 바꿨다. 또 intent의 '부분 환불 회수도 2%'는 사람 지시로 이번에 제외했다"
  evidence: "수정 전 earnPoints는 amounts.total의 1% 반올림, 2%만 올리면 O-1107은 547P. 환불 제외는 사람 메시지"
risks:
  - "부분 환불 회수는 여전히 1% 단순 곱(적립 초과 가능). 2% 적립 주문이 부분 환불되면 회수가 적립의 절반 수준이다. 정산팀 결정 대기. 완료조건 '적립 및 회수가 상수 한 곳'은 의도적으로 충족하지 않음"
  - "앞 Work(w-20261004-001, -002)에서 같은 파일을 고쳤을 수 있음, 머지 대기. 머지 시 충돌 가능"
  - "기존 테스트 2개(order, gift)의 기댓값을 바꿨다. 약화 여부는 verify가 판단"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수의 새 적립률 적용 여부는 정산팀과 따로 정한다. 그때까지 회수율은 REFUND_RECOVERY_RATE_PERCENT(1%)로 유지한다 (사람)"
---
## 요약
적립률을 2%로 올리고, 주문·선물 적립을 `earnOn`(상품 − 쿠폰 − 사용 포인트 버림) 한 곳에서 계산하게 했다. O-1107은 486P. 환불 회수는 그대로 1%이고 R-0311은 131P다.
## 다음 task가 알아야 할 것
- `src/points/earn.js` earnOn / earnPoints, `src/config.js` REFUND_RECOVERY_RATE_PERCENT(환불 전용 1%)
- 테스트: `npm test` 24개 통과, 새 테스트 `test/earn.test.js`
- 확인: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → 회수 131P
- 저장된 points.earned, src/format, refund 테스트는 건드리지 않았다
