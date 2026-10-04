---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 차단·권장(1번 부분 환불 회수)만 반영, 사소(2번)는 반영하지 않음"
    why: "사람이 '차단·권장만 반영'을 골랐다"
    by: human
assumptions:
  - "적립 안내 원문이 없어 고객센터 계산값(237P)에서 역산한 규칙을 기준으로 삼았다"
rejected:
  - "earnBase 음수 방어 추가: assertPointUse가 이미 막아 실제로 생기지 않음"
open_questions: []
intent_deviation: null
risks:
  - "적립 규칙은 O-1042 한 건에서 역산했다. 다른 케이스에서 안내와 다르면 어긋날 수 있다"
  - "examples/O-1077.json을 CLI로 돌리면 pointsUsed 입력이 없어 423P로 보인다(저장값 403P). 입력 형식 차이"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 후 부분 환불 회수를 새 적립 규칙에 맞춰 고쳤다(커밋 5eb6790). 완료조건 5개 모두 통과, `npm test` 27 통과, O-1042는 237P.
새 지식: docs/knowledge/points/earn-rule.md — 적립 규칙(기준 금액, 내림, 선물·환불 공유)에 맞는 기존 항목이 없음
## 다음 task가 알아야 할 것
- `src/orders/refund.js`: 회수 = 환불 전 적립 - 환불 후 적립 (`earnPoints` 사용). R-0311 회수는 -132P.
- `test/refund.test.js` 끝에 O-1077/R-0311 테스트 추가.
- 테스트 파일 변경은 모두 약화 아님.
