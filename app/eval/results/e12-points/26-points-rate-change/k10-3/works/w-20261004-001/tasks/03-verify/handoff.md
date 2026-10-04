---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)을 반영하지 않는다"
    why: "사람이 반영하지 않음을 선택. percentOf는 공용 유틸, 과거 주문 처리는 소급 금지 비목표"
    by: human
assumptions:
  - "고객센터 규칙은 O-1042 한 건에서 역산한 것이라 다른 주문으로는 확인하지 않음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "과거 주문(옛 기준 저장 적립)의 부분 환불 회수 값이 저장 적립과 어긋날 수 있다"
  - "`percentOf`가 미사용으로 남아 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 결과 차단·권장 지적은 없고 사소 2건은 반영하지 않았다. 완료조건 6개 모두 통과했다. O-1042 237P, `npm test` 27개 통과, 새 테스트는 기준 커밋 src에서 5개 실패한다. 바뀐 테스트 파일은 새 `test/earn.test.js`뿐이라 약화 아님이다.
새 지식: docs/knowledge/points/earn-base.md — 맞는 기존 항목이 없는 까닭(적립 기준 규칙, 사람이 알려 줌)
새 지식: docs/knowledge/points/partial-refund-recovery.md — 맞는 기존 항목이 없는 까닭(부분 환불 회수 방식)
## 다음 task가 알아야 할 것
- 산출물: `verification.md`, `pr.md`(이 task 디렉터리).
- 확인 명령: `node src/cli.js examples/O-1042.json`, `npm test`.
- `src/orders/refund.js:36` 회수 계산은 과거 주문 저장값과 어긋날 수 있다.
