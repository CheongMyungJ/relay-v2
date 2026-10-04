---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적을 반영하지 않음 (부분 환불 회수 기준 불일치는 남은 위험으로 기록)"
    why: "의도의 범위 밖이고 회수 기준은 따로 정해야 함"
    by: human
assumptions:
  - "partial refund 경로는 이번 변경이 건드리지 않았으므로 저장값 재계산 금지 조건은 통과로 판정"
rejected:
  - "사소 지적 2(경계 테스트 부족): 389.5→389 로 버림 경계를 이미 검증해 철회"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수(src/orders/refund.js:34)가 옛 기준이라 적립과 어긋날 수 있음"
  - "선물하기 적립(src/gift/gift-points.js)은 total 반올림 기준 그대로"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(권장, 부분 환불 회수 기준)은 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과, `npm test` 22 pass, O-1042 237P 재확인. 테스트 파일은 추가만 있어 약화 아님.
새 지식: docs/knowledge/points/earn-basis.md — 맞는 기존 항목이 없는 까닭: docs/knowledge가 비어 있었음
## 다음 task가 알아야 할 것
- `src/points/earn.js:7`: 새 기준, `src/money.js`: `floorPercentOf`
- 아직 따르지 않는 곳: `src/gift/gift-points.js`, `src/orders/refund.js:34` (지식 파일에 기록)
- 테스트: `npm test`, 재현: `node src/cli.js examples/O-1042.json`
