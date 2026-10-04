---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1번(차단)만 반영하고 2, 3번은 반영하지 않는다"
    why: "사람이 1번만 반영하고 2, 3번은 이번 범위 밖이라 보고만 하라고 함"
    by: human
  - what: "옛 1% 저장 주문의 환불 회수는 환불 회수 방식은 그대로 두고, 그 주문의 적립률(1%)로 재계산해 음수를 막는다"
    why: "사람이 환불 회수 계산 방식은 바꾸지 말고 옛 주문 환불이 이전과 같게(음수 없이) 나오게만 하라고 함"
    by: human
assumptions:
  - "옛 주문 판별은 저장된 적립 값이 결제 금액 × 1% 반올림과 같고 지금 규칙의 값과 다른지로 한다 (적립률 저장 필드가 없음)"
  - "이전과 같게의 기준은 팀 지식의 132P로 봄 (변경 전 코드는 131P)"
rejected:
  - "회수를 0으로 막는 방식: 사람이 이전과 같은 결과를 요청함"
open_questions: []
intent_deviation: null
risks:
  - "반복 부분 환불(alreadyRefunded)에서 앞 환불의 회수분을 다시 회수함. 범위 밖으로 두고 보고만 함"
  - "옛 주문 판별이 값 일치에 기대 우연히 2% 값과 같으면 구분되지 않음"
  - "옛 주문 환불 회수 132P, 변경 전 코드는 131P"
  - "앞 Work(w-20261004-001, -002)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰에서 차단 1건(옛 1% 저장 주문 환불 시 회수 −140P)을 찾아 사람이 고르고 반영했다(커밋 60d855f). 지금은 132P. 권장 1건(반복 환불 중복)과 사소 1건은 범위 밖으로 보고만 했다. 완료조건 6개 모두 통과, `npm test` 25개 통과.
고친 지식: docs/knowledge/points/earn-points-rule.md — 적립률 1→2 이력과 새 주문에만 적용 규칙 추가
고친 지식: docs/knowledge/points/refund-points-recovery.md — 환불 회수에 쓸 적립률(옛/새 주문별 선택 포함)은 정산팀과 따로 정함(정하지 않은 것으로 이동)
## 다음 task가 알아야 할 것
- `src/points/earn.js`의 `earnedRatePercent`, `src/config.js`의 `LEGACY_POINT_RATE_PERCENT`
- 환불 CLI: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P
- 커밋: 60d855f(수정), 0bb72e8(지식)
