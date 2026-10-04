---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "기대값 218P는 고객센터 계산이며, 일반 주문과 같은 적립 방식으로 맞춘다고 보았다"
  - "예시 파일에는 amounts가 없어 249P/218P 재현 방법은 fix에서 확인한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "G-0213의 218P가 일반 주문 적립 규칙과 정확히 맞는지는 fix에서 계산으로 확인해야 한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
G-0213 선물 주문의 적립 예정 포인트를 218P로 고치는 의도 초안을 썼다. 메시지 카드, 받는 사람 정보, 영수증 글자, 이미 적립된 포인트는 건드리지 않는다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`)
- 수정 대상으로 지목된 파일: `src/gift/gift-points.js` (`giftPoints`)
- 참고 지식: `docs/knowledge/points/earn-base-and-rounding.md` (일반 주문 적립 기준과 반올림 방식, 이 파일의 "아직 규칙을 따르지 않는 곳"에 gift-points.js가 있음. 조사 결과이므로 원인 근거는 fix에서 직접 확인)
- 참고 지식: `docs/knowledge/points/stored-points-earned.md` (저장된 `points.earned`는 다시 계산하지 않음, intent 제약에 옮김)
- `examples/G-0213.json`: 상품 15900x1 + 4480x2, 쿠폰 2000, 포인트 사용 1000. `amounts` 필드는 없음
