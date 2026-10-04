---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1, 2를 반영하지 않는다"
    why: "1은 입력 규약 변경이 필요해 의도 밖이고 2는 정상 데이터에서 생기지 않음. 사람이 선택"
    by: human
  - what: "완료조건 '같은 입력에서 refundAmount와 영수증 출력이 수정 전과 같다'를 통과로 판정한다"
    why: "형식과 refundAmount, 주문 영수증은 같고 환불 영수증의 포인트 회수 값 변화(131→132)는 목표의 결과. 사람이 선택"
    by: human
assumptions:
  - "earn-basis.md의 앞 Work 내용은 context.md에 보인 것을 모두 살려 같은 경로에 새로 썼다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "여러 번 나눠 부분 환불하면 회수 합계가 earned를 넘을 수 있음"
  - "earned가 재계산 적립보다 작으면 회수가 음수가 될 수 있음"
  - "환불 영수증 출력 테스트가 없음"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: src/orders/refund.js, src/points/earn.js(percentOf 반올림 사용 중)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(권장 1, 사소 1)은 사람이 반영하지 않기로 했다. 재현(132P)과 `npm test` 22개 통과를 다시 확인했고 완료조건 6개 모두 통과. 테스트 파일 변경은 약화 아님. verification.md와 pr.md를 썼다.
고친 지식: docs/knowledge/points/earn-basis.md — 부분 환불 회수 기준을 "저장된 earned − 남은 상품 재계산 적립(버림)"으로 바꾸고 비율 안분 규칙을 대체, R-0311 132P 사실과 다회 환불 미정 사항 추가
## 다음 task가 알아야 할 것
- 변경 지점: `src/orders/refund.js:34`, `src/money.js`의 `floorPercentOf`
- 테스트: `npm test`, 새 테스트는 `test/refund.test.js` 끝 2개
- 다회 부분 환불 합계 초과는 팀 지식 `## 아직 정하지 않은 것`에 기록
