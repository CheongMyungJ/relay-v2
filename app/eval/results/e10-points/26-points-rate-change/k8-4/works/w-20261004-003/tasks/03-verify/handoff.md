---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1~3(모두 사소)은 반영하지 않는다"
    why: "사람이 반영하지 않음을 골랐다"
    by: human
  - what: "완료조건 '환불 코드는 수정하지 않았다'를 통과로 판정한다"
    why: "refund.js는 상수 참조 한 줄만 바뀌고 동작이 불변이며, 사람이 fix에서 허락한 변경"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "환불 회수 1%, 적립 2%라 새 주문을 부분 환불하면 적립분보다 적게 회수된다. 정산팀 결정 대기"
  - "앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기. refund.js 회수 계산을 바꿨다면 이 Work의 변경과 충돌할 수 있다"
  - "earnBase가 음수가 되는 입력(쿠폰+사용 포인트 > 상품 금액)은 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건(모두 사소)은 사람이 반영하지 않기로 했다. 완료조건 7개 모두 통과(환불 코드 항목은 사람이 통과로 판정). `npm test` 22개 통과, O-1107=486, G-0213=437을 직접 확인했다. 바뀐 테스트 파일 3개는 모두 약화 아님.
고친 지식: docs/knowledge/points/earn-rule.md — 적립률 1%→2% 이력, 저장 주문 소급 금지와 "규정은 비율만 바뀐다" 규칙, 2%일 때 O-1107 예 추가
고친 지식: docs/knowledge/points/partial-refund-recovery.md — 환불 회수율은 적립률과 별개(`REFUND_RECOVERY_RATE_PERCENT` 1%), 변경은 정산팀 결정 뒤 별도 Work
## 다음 task가 알아야 할 것
- `src/points/earn.js`: earnBase/earnOn. `src/orders/refund.js:34`는 `REFUND_RECOVERY_RATE_PERCENT`를 쓴다.
- 지식 파일 두 개는 앞 Work 내용을 살려 이 브랜치에 새로 썼다. 머지 때 -001/-002 파일과 충돌 가능.
- 산출물: verification.md, pr.md (같은 task 디렉터리).
