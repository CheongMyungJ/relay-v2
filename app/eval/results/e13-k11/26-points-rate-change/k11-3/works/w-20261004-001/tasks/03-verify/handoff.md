---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 차단·권장만 반영 (1번 반영, 2번 미반영)"
    why: "사람이 선택"
    by: human
  - what: "부분 환불 회수를 환불 전후 남은 주문 적립(순 금액, 버림)의 차이로 계산"
    why: "분할 환불의 버림 누적을 없애고 적립 기준과 맞추려고"
    by: ai
assumptions:
  - "환불 회수 기준은 남은 주문이 쿠폰과 사용 포인트를 그대로 갖는 구조를 따른다"
rejected:
  - "percentOf 삭제: 사람이 반영하지 않기로 함, 무해"
open_questions: []
intent_deviation: null
risks:
  - "환불 회수 기준은 사람이 따로 확인하지 않았음"
  - "저장된 옛 points.earned와 환불 회수가 1P 안팎 다를 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 1건을 반영해 환불 회수를 남은 주문 적립 차이로 계산하게 했다. 완료조건 7개 모두 통과, `npm test` 26건 통과.
새 지식: docs/knowledge/points/earn-basis.md — 적립 기준에 맞는 기존 항목이 없음
## 다음 task가 알아야 할 것
- `src/orders/refund.js:30-36`: 회수 계산, 커밋 6314bcd
- 확인: `npm test`, `node src/cli.js examples/O-1042.json`
- 산출물: verification.md, pr.md
