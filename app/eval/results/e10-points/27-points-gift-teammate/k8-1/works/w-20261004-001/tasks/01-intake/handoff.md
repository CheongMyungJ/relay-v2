---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "적립 안내의 계산 기준은 요청에 적혀 있지 않아, O-1042가 237P가 되는 것을 기준으로 삼았다"
  - "완료조건의 재현 절차는 README의 `node src/cli.js examples/O-1042.json`으로 잡았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "적립 안내의 정확한 기준 문서가 없어, 237P 외의 주문(O-1077, O-1107 등)의 기대값은 확인되지 않음"
  - "선물하기 적립이 earnPoints를 공유하면 수정이 영향을 줄 수 있음"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립(`src/gift/gift-points.js`)은 다른 팀과 같이 보고 있어 이 팀이 단독으로 고치지 않는다 (사람)"
---
## 요약
O-1042 적립 예정 포인트가 268P로 나오는 버그(기대 237P)의 intent 초안을 썼다. 비목표: 저장된 적립 값 재계산, `src/format/`, `src/gift/gift-points.js`.
## 다음 task가 알아야 할 것
- 요청 원인 추정: `src/points/earn.js`(`earnPoints`가 `order.amounts.total`에 `POINT_RATE_PERCENT`=1%를 곱함, `src/config.js`). 확인되지 않음.
- 입력 예: `examples/O-1042.json`(쿠폰 3000, 포인트 사용 1500). 테스트는 `npm test`(node --test).
- `src/gift/gift-points.js`가 `earn.js`를 쓰는지 fix에서 확인할 것.
