---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 호출하게 해 규칙을 한 곳으로 모았다"
    why: "복사본을 따로 고치면 다시 어긋난다. 비목표(일반 주문 계산 변경 금지)도 지킨다"
    by: ai
assumptions:
  - "218P를 올바른 값으로 본다(intake의 가정을 그대로 따른다)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "G-0213 영수증의 '적립 예정' 줄이 249P에서 218P로 바뀐다(의도한 변경). 이미 적립된 포인트는 건드리지 않았다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트 계산은 src/points/earn.js의 earnPoints 하나로 한다. 주문 종류별로 따로 계산하면 규칙이 어긋난다(5ff61ae 때 선물하기만 빠졌다)"
---
## 요약
선물하기 적립이 배송비를 빼지 않고 반올림하던 것을 `earnPoints` 재사용으로 고쳤다. G-0213은 249P에서 218P가 됐다. 재현 테스트를 추가했고 `npm test`는 23개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js`, 테스트: `test/gift.test.js` 마지막 케이스
- 확인 명령: `node src/cli.js examples/G-0213.json`, `npm test`
- `percentOf`(반올림)는 `giftPoints`에서 더 쓰지 않는다. 다른 곳의 사용은 확인하지 않았다
