---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(사소: percentOf 미사용, README 적립 기준 미기재)을 반영하지 않는다"
    why: "둘 다 동작과 무관한 사소한 지적이라 사람이 반영하지 않기로 함"
    by: human
assumptions:
  - "적립 기준은 예시 한 건(237P)에서 역산한 것이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "안내 문구가 예시와 다르면 기준을 다시 맞춰야 한다"
  - "부분 환불 회수는 쿠폰·사용 포인트를 안분하지 않는다(기존 환불 규칙)"
  - "`percentOf`(src/money.js)가 미사용으로 남아 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
변경을 리뷰해 사소한 지적 2건을 찾았고 사람이 반영하지 않기로 했다. 완료조건 6건 모두 통과: `npm test` 24건 통과, O-1042는 237P. 바뀐 테스트 파일 3개는 추가만 있어 약화 아님.
새 지식: docs/knowledge/points/earn-basis.md — 맞는 기존 항목이 없는 까닭: 팀 지식 항목이 하나도 없었다
## 다음 task가 알아야 할 것
- `src/points/earn.js`의 `pointsFor`/`earnPoints`가 적립 기준. 일반·선물하기·환불 회수가 함께 쓴다
- 검증 명령: `npm test`, `node src/cli.js examples/O-1042.json`
- 산출물: tasks/03-verify/verification.md, pr.md
