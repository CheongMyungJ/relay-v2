---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 회수 포인트의 새 비율 적용은 이번 범위에서 뺌"
    why: "정산팀과 따로 정함"
    by: human
  - what: "유형 불일치(정책 변경)인데 bugfix 유형 그대로 진행"
    why: "사람이 유형 유지를 선택함"
    by: human
assumptions:
  - "선물하기 적립(`src/gift/gift-points.js`)은 적립 계산이므로 2% 적용 대상으로 봄"
  - "O-1107 기대값 486P는 (27350−2000−1020)=24330의 2%=486.6을 버림한 값으로 맞춰 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "`src/orders/refund.js:34`가 `POINT_RATE_PERCENT`를 직접 쓴다. 이 값을 바꾸면 환불 회수도 함께 달라질 수 있어 범위 밖인 환불 회수 결과가 유지되는지 확인해야 함"
  - "팀 지식 earn-rule.md는 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에는 아직 없음. 현재 코드(`src/points/earn.js`)는 총액에 `percentOf`를 쓰는 옛 방식일 수 있음. 앞 Work에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "아직 규칙을 따르지 않음: src/orders/refund.js — 환불 회수 비율 적용 여부는 정산팀과 따로 정함, 사람이 이번 범위에서 뺌 (사람)"
  - "기본 적립률을 2026-10-04 배포부터 1%에서 2%로 올림 (사람)"
---
## 요약
적립률 1%→2% 변경 intent 초안을 썼다. 유형은 사람이 bugfix로 유지했다.
## 다음 task가 알아야 할 것
- `src/config.js:9` `POINT_RATE_PERCENT = 1`; 사용처 `src/points/earn.js`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`
- 테스트: `npm test` (node --test)
- 예시 `examples/O-1107.json`: 상품 27350, 쿠폰 2000, 사용 1020, 기대 486P
- 참고 팀 지식: `docs/knowledge/points/earn-rule.md`, `docs/knowledge/format/receipt-text-fixed.md` (기준 브랜치에는 아직 없음)
