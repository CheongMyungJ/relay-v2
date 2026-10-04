---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 권장(README 안내)만 반영하고 사소(음수 기준 금액)는 반영하지 않음"
    why: "사람이 차단·권장만 반영을 선택"
    by: human
  - what: "order/gift 테스트 기대값 변경 2건을 약화 아님으로 판단"
    why: "2% 요구에 맞춘 기대값 상향이고 검증 대상은 그대로"
    by: ai
assumptions: []
rejected:
  - "기준 금액 음수 대비 0 하한: 현재 입력으로 발생하지 않아 반영하지 않음"
open_questions: []
intent_deviation: null
risks:
  - "환불 회수는 1% 반올림 그대로라 적립 2%와 불일치. 정산팀 결정 대기"
  - "앞 Work(w-20261004-001/002)에서 고쳤을 수 있음, 머지 대기. refund.js와 earn-rule.md 머지 시 충돌 가능"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 README의 낡은 상수명(권장)만 고쳐 커밋(7fef5e0)했다. 완료조건 8개 모두 통과, `npm test` 25개 통과. 변경된 기존 테스트 2건은 약화 아님.
고친 지식: docs/knowledge/points/earn-rule.md — 적립률 1%→2%, 예시 475P·486P로 갱신
새 지식: docs/knowledge/points/refund-recover-rate.md — 환불 회수율 REFUND_RECOVER_PERCENT(1%) 분리를 다루는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 재현: O-1107 `createOrder` → total 27330, earned 486
- `src/config.js`: `EARN_RATE_PERCENT=2`, `REFUND_RECOVER_PERCENT=1`
- 미반영 지적: `src/points/earn.js:9` 음수 기준 금액 하한
