---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 그대로 재사용한다"
    why: "docs/knowledge/points/earn-rule.md의 규칙과 사람의 결정(선물하기에도 일반 주문 규칙 적용)"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기에 이 규칙을 적용하는 것은 다른 팀과 합의가 확인되지 않았다. 사람이 이번 Work에서 적용하라고 결정함"
  - "배송비가 있는 선물 주문은 적립 포인트가 이전보다 줄어든다"
recommended_next: null
knowledge_candidates:
  - "고객센터 계산으로 선물하기 주문 G-0213의 적립 포인트는 218P여야 한다 (사람)"
  - "정하지 않음: 선물하기 적립에 일반 주문 규칙을 적용할지 — 다른 팀과 같이 정함, 이번 Work에서는 사람이 적용하기로 결정함 (사람)"
---
## 요약
선물하기 적립이 배송비 포함 total을 반올림하던 것을 일반 주문의 `earnPoints`로 바꿨다. G-0213이 249P에서 218P가 됐고 재현 테스트를 추가했다. `npm test` 25개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js` (`earnPoints` 호출)
- 테스트: `test/gift.test.js` 마지막 케이스
- 확인: `node src/cli.js examples/G-0213.json` → 218P
- 이미 적립된 포인트는 건드리지 않음
