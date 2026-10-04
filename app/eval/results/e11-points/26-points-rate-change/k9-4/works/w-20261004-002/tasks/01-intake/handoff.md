---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "정산팀 기대값 132P는 팀 지식의 규칙(환불 전 적립 − 환불 후 적립)과 같은 방식이라고 보았다"
  - "완료조건에 회귀 테스트 추가를 넣었다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목 두 개는 기준 브랜치에 아직 없다(앞 Work w-20261004-001, 머지 대기). 같은 규칙을 어기는 코드가 `src/points/earn.js` 등에 있으면 앞 Work에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트가 정산팀 계산과 1~2P 어긋나는 버그의 intent 초안을 썼다. 원인과 수정 방법은 쓰지 않았다.
## 다음 task가 알아야 할 것
- 요청 위치: `src/orders/refund.js`의 `createRefund`. 테스트는 `npm test`(`node --test`), 관련 테스트 `test/refund.test.js`
- 참고(내 가설, intent에는 안 씀): 지금 코드는 `pointsRecovered`를 환불 상품 금액에 `percentOf`로 계산한다. O-1077/R-0311은 13130원이라 131P(반올림)이고, 규칙대로 하면 적립 403P − 환불 후 적립 271P(27180원 기준, 쿠폰 5000·사용 2000 반영)=132P로 정산팀 값과 같다
- 참고할 팀 지식: `docs/knowledge/points/earn-rule.md`, `docs/knowledge/format/receipt-text-fixed.md` (둘 다 기준 브랜치에 아직 없음)
- 예시: `examples/O-1077.json`, `examples/R-0311.json`
