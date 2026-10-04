---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)을 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 골랐다"
    by: human
  - what: "바뀐 기존 테스트 2곳(order, gift)은 율에 따른 기대값 변경이라 약화 아님으로 판정한다"
    why: "단언 수와 종류가 같고 기대값만 2% 계산값으로 바뀜"
    by: ai
assumptions: []
rejected:
  - "README 숫자 제거, 환불 회수 테스트 주석 추가: 사소해서 사람이 반영하지 않음"
open_questions: []
intent_deviation:
  summary: "intent는 환불 회수도 같은 2%를 쓴다고 했지만 환불 회수는 1% 그대로다"
  evidence: "t-02에서 사람이 환불 회수 포인트를 새 비율로 계산할지는 정산팀과 따로 정하니 건드리지 말라고 답함"
risks:
  - "환불 회수는 1% 반올림이라 2%로 적립된 주문을 부분 환불하면 적립보다 적게 회수된다"
  - "앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기: 부분 환불 규칙(저장된 earned − 남은 적립)이 이 브랜치 refund.js에 없다. 머지할 때 earn.js, refund.js가 겹칠 수 있다"
  - "1%로 적립된 기존 주문에 부분 환불 규칙을 적용하면 음수가 된다(O-1077/R-0311: 403 − 543)"
  - "저장된 earned가 다시 계산되지 않는다는 조건은 코드 읽기로 확인했고 직접 겨냥한 테스트는 없다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이었고 사람이 반영하지 않기로 했다. 완료조건 6개는 모두 통과했다(`npm test` 22개, O-1107 486P, 기준 커밋에서는 273P로 재현). 바뀐 테스트 파일 3개는 약화가 아니다.
고친 지식: docs/knowledge/points/earn-base.md — 적립률 2%(2026-10-04 배포), 이미 적립된 값은 다시 계산하지 않음, 환불 회수 줄을 partial-refund-recovery.md 참고로 바꿈 (이 브랜치에 없던 앞 Work 항목을 모두 살려 같은 경로에 새로 씀)
고친 지식: docs/knowledge/points/partial-refund-recovery.md — 환불 회수율(2% 적용 여부)을 `아직 정하지 않은 것`으로, refund.js를 `아직 규칙을 따르지 않는 곳`으로 추가 (앞 Work 내용을 모두 살려 같은 경로에 새로 씀)
## 다음 task가 알아야 할 것
- 재현: `node -e "import('./src/index.js').then(m=>console.log(m.createOrder(JSON.parse(require('fs').readFileSync('examples/O-1107.json'))).points))"` → 기준 커밋 273, 지금 486
- 환불 회수율은 `src/config.js`의 `REFUND_RECOVERY_RATE_PERCENT = 1`(`src/orders/refund.js:34`), 정산팀이 정하면 바꾼다
- 바뀐 테스트: `test/order.test.js:26`, `test/gift.test.js:14`(기대값만), 새 `test/earn-rate.test.js`
