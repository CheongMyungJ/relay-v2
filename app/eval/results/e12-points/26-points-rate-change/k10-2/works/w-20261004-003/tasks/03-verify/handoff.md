---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(선물하기 주문의 ratePercent 저장)만 반영, 지적 2(사소)는 반영하지 않음"
    why: "사람이 차단·권장만 반영을 고름"
    by: human
  - what: "바뀐 기존 테스트 3개 파일은 약화 아님으로 판정"
    why: "기대값만 새 적립률에 맞춰 바꿨고 단언·케이스는 그대로"
    by: ai
assumptions:
  - "적립률 변경 전 저장된 주문은 모두 1%로 적립됐다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립률을 2%로 올릴지 미정, 지금은 상수를 따라 2%"
  - "앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기. earnPoints와 refund.js가 겹칠 수 있다"
  - "저장 주문에 points.ratePercent 필드가 늘었다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 권장 1건을 반영했다. 선물하기 주문도 `points.ratePercent`를 저장한다(커밋 68fb9ac). 완료조건 6개 모두 통과, `npm test` 28개 통과, O-1107은 486P.
고친 지식: docs/knowledge/points/earn-basis.md — 2% 적립률, 저장된 적립률로 환불 재계산, 선물하기 적립률 미정 사항 추가
## 다음 task가 알아야 할 것
- `src/gift/gift-order.js:36` ratePercent 저장, `test/gift.test.js` 끝 테스트
- 검증 명령: `npm test`, O-1107 재현은 fix.md의 node 명령
- 바뀐 기존 테스트: order, gift, refund (약화 아님)
