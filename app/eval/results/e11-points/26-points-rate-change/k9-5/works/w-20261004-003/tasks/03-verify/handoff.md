---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "사소한 리뷰 지적 2건(percentOf 미사용, giftPoints 래퍼)을 반영하지 않는다"
    why: "동작에 영향이 없고 사람이 반영하지 않음을 선택"
    by: human
  - what: "부분 환불 회수(pointsRecovered)를 기존 동작(1%, 반올림)으로 되돌리고 적립(일반 주문·선물)만 2%로 바꾼다"
    why: "환불 회수에 새 비율을 쓸지는 이번 범위가 아니고 정산팀과 따로 정하기로 함"
    by: human
  - what: "환불 회수 비율을 config.js의 REFUND_RECOVER_RATE_PERCENT = 1로 분리한다"
    why: "POINT_RATE_PERCENT를 2로 올려도 환불 회수가 바뀌지 않게 하려면 별도 값이 필요"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation:
  summary: "intent의 '부분 환불 회수가 2%로 회수된다'와 완료조건 '일반 주문, 선물하기, 부분 환불 회수가 같은 적립 계산을 쓴다'를 지키지 않는다"
  evidence: "verify 단계에서 사람이 환불 회수는 이번 범위가 아니라 정산팀과 따로 정한다고 지시. 해당 완료조건은 실패로 기록"
risks:
  - "부분 환불 회수가 1%·반올림이라 적립(2%·버림)보다 적게 회수될 수 있음. 정산팀 결정 대기"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: earn.js/refund.js 기준액 계산이 겹쳐 머지 시 충돌 가능"
recommended_next: null
knowledge_candidates: []
---
## 요약
사람 지시로 부분 환불 회수를 원래 동작(1%, 반올림)으로 되돌리고 일반 주문·선물만 2%로 했다. O-1107 = 486P, `npm test` 21개 통과. 완료조건 중 "환불 회수가 같은 적립 계산을 쓴다"는 지시에 따라 실패로 기록했고 그대로 완료 화면으로 간다.
고친 지식: docs/knowledge/points/earn-rule.md — 적립률 2%와 이력을 더하고, 환불 회수는 `## 아직 규칙을 따르지 않는 곳`에 범위 밖으로 기록
## 다음 task가 알아야 할 것
- `src/config.js` `REFUND_RECOVER_RATE_PERCENT`(1%): 환불 회수 비율. 정산팀 결정 후 적립 규칙으로 맞출 때 바꿀 곳은 `src/orders/refund.js`.
- 테스트: `npm test`.
