---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 2번(사소, 빈 줄)만 반영하고 1번(권장, 1% 저장 주문 과다 회수)은 반영하지 않는다"
    why: "1번은 머지 대기 중인 w-20261004-002 범위와 겹쳐 충돌한다. 남은 위험으로 기록"
    by: human
  - what: "변경된 기존 테스트 기대값은 약화 아님으로 판단한다"
    why: "1%→2% 변경에 맞춘 값 수정이고 단언 수와 내용은 같다"
    by: ai
  - what: "refund.js의 버림 변경, 버림 회수 테스트, 환불 회수 지식을 되돌린다"
    why: "환불 회수 계산은 정산팀과 따로 정하기로 해 이번 범위가 아니다"
    by: human
  - what: "refund.js를 1%로 고정하지 않고 현재 상태(상수를 읽어 2% 반올림)로 두며 남은 위험으로만 기록한다"
    why: "환불 회수에 새 비율을 쓸지는 이번 범위가 아니라 정산팀과 따로 정한다"
    by: human
assumptions: []
rejected:
  - "환불 회수에 버림 적용: 사람이 범위 밖이라고 되돌리게 함"
  - "refund.js에 원래 적립 − 남은 상품 재계산 넣기: 앞 Work(w-20261004-002) 범위, 충돌"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기: 1% 시절 저장 주문 부분 환불이 2%로 과다 회수됨"
  - "refund.js는 코드 그대로지만 POINT_RATE_PERCENT를 읽어 부분 환불 회수가 2%(반올림)로 바뀐다. 정산팀 결정 대기"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: earn.js·refund.js 충돌 가능"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 사람이 고른 사소 1건(빈 줄)만 반영했다. 완료조건 6개 모두 통과, `npm test` 22 통과. O-1107은 486P. 바뀐 테스트 3개 파일은 모두 약화 아님.
남긴 지식: docs/knowledge/gift-points-rate-separate.md, docs/knowledge/points-rate-2-percent.md
## 다음 task가 알아야 할 것
- 재현: `node src/cli.js examples/O-1107.json` → 적립 예정 486P
- 적립 `src/points/earn.js:6`, 상수 `src/config.js`(`POINT_RATE_PERCENT`, `GIFT_POINT_RATE_PERCENT`)
- 미반영 권장 지적: 1% 저장 주문의 부분 환불 과다 회수(w-20261004-002 머지 필요)
