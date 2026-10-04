---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "리뷰 지적 중 권장 1번(alreadyRefunded 해석을 가정으로 표시)만 반영하고 사소 2번은 반영하지 않음"
    why: "사람이 '차단·권장만 반영'을 골랐다"
    by: human
assumptions: []
rejected:
  - "지적 2(쿠폰만, 사용 포인트만 있는 경우의 테스트 추가): 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "alreadyRefunded가 있는 경우의 계산(83P)은 정산팀이 확인한 값이 아니다"
  - "저장된 주문의 earned가 옛 계산이면 첫 환불 회수가 어긋날 수 있음(비목표)"
  - "w-20261004-001 머지 뒤 earnedOn과 earnPoints가 겹침. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 권장 1건만 반영했다. 모든 완료조건이 통과했고 `npm test` 22개가 통과한다. R-0311은 132P다.
고친 지식: docs/knowledge/points/earn-base-and-rounding.md — 부분 환불 회수 포인트 규칙을 추가하고, 이 파일이 가리키던 상품 금액 기준을 지웠다. 앞 Work 내용은 살려서 같은 경로에 썼다.
## 다음 task가 알아야 할 것
- 커밋 83f556d: refund.js의 가정 주석, 테스트 이름, 지식 파일.
- `src/orders/refund.js`의 `earnedOn`과 `earnedBefore`가 핵심이다.
- `npm test`는 22개 통과, 테스트 변경은 추가뿐이다.
