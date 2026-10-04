---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "O-1042 예시에는 저장된 적립이 없어, 저장값을 넣은 주문으로 receiptLines를 실행해 저장값 사용을 확인함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "적립 2%, 환불 회수 1%라 회수가 적립보다 적게 잡힘. 정산팀과 따로 정할 범위 밖 사항"
  - "앞 Work(w-20261004-001, -002)에서 고쳤을 수 있음, 머지 대기. 머지 시 earn.js, refund.js 충돌 가능"
  - "earnPoints는 음수 방어가 없음. 쿠폰이 상품 금액을 넘는 주문은 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 완료조건 7개 모두 통과(직접 재실행). 테스트 파일 변경 3건은 모두 약화 아님.
새 지식: docs/knowledge/points/point-rate.md — 적립률 2%와 저장 주문 불변, 환불 회수 분리를 다루는 기존 항목이 없음
고친 지식: docs/knowledge/points/partial-refund-recovery-not-proportional.md — 앞 내용을 살리고 refund.js가 아직 규칙을 따르지 않는 곳(사람이 범위에서 뺌)을 추가
## 다음 task가 알아야 할 것
- 환불 회수 변경 전후 비교: O-1107/O-1077/O-1042 각 첫 상품 1개 환불이 129/129/89로 같음
- `npm test` 23건 통과, 재현 명령 486 출력
- `pr.md`는 한국어로 작성(레포 커밋 언어)
