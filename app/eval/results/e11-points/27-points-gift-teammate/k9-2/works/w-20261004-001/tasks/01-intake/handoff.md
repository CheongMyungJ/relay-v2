---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "고객센터 계산 기준은 O-1042의 237P 값 하나만 확인됨. 다른 주문의 기대값은 없음"
  - "요청의 '적립 예정 포인트'는 주문 생성 시 저장되는 points.earned를 뜻한다고 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "고객센터 계산 기준이 값 하나뿐이라 fix에서 다른 예시 주문(O-1077, O-1107)의 기대값을 따로 확인해야 할 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
적립 포인트가 고객센터 계산(O-1042: 237P)보다 많은 버그의 의도 초안을 썼다. 저장된 적립값 유지, 영수증 글자 불변, 선물하기 적립 미수정을 비목표와 제약으로 넣었다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js` (`earnPoints`), 호출은 `src/orders/order.js:35`. 비율은 `src/config.js`의 `POINT_RATE_PERCENT`
- 예시 주문: `examples/O-1042.json`, `O-1077.json`, `O-1107.json`. 테스트는 `npm test`(node --test)
- 참고(원인 확인 안 됨): O-1042 `amounts.total`은 26770이고 1% 반올림이 268이다. 237은 23770의 1% 내림과 일치한다. fix에서 직접 확인할 것
