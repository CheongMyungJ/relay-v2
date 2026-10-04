---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "차단·권장 지적만 반영(1번 테스트 보강), 사소 지적(2번)은 반영하지 않음"
    why: "사람이 차단·권장만 반영을 선택"
    by: human
  - what: "팀 지식 refund-recovery-vs-earn-basis.md를 정산팀 식으로 고쳐 남김"
    why: "앞 Work의 '환불 상품 금액 × 1%' 식이 이번에 사람이 알려 준 규칙과 어긋남"
    by: ai
assumptions:
  - "이전 부분 환불은 같은 식으로 회수됐다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이미 처리한 환불이 옛 식(반올림)으로 회수됐으면 이후 환불에서 1P 차이 가능"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: refund.js와 refund-recovery-vs-earn-basis.md 충돌 가능"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 권장 1건을 반영했다(수정 전에도 통과하던 나눠 환불 테스트를 잡아내는 세 번 나눠 환불 테스트 추가, 커밋 06a8915). 완료조건 6개 모두 통과, `npm test` 23개 통과.
남긴 지식: docs/knowledge/refund-recovery-vs-earn-basis.md
## 다음 task가 알아야 할 것
- `src/orders/refund.js:29-35` 회수 계산, `src/money.js` `floorPercentOf`
- 테스트 `test/refund.test.js` 하단 3개. 명령 `npm test`
- 예: O-1077을 SP, SP, TW 순으로 환불하면 합계 215(매번 반올림하면 216)
