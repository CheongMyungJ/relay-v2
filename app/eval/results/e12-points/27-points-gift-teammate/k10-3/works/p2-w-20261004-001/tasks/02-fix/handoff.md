---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 호출하게 해 선물하기도 일반 주문과 같은 적립 기준을 쓴다"
    why: "사람이 준 목표값 218P가 일반 주문 기준(배송비 제외, 버림)으로 나오고, 완료조건이 일반 주문과 같은 값을 요구함. 팀 지식 docs/knowledge/points/earn-basis.md의 미정 사항은 사람이 218P를 확인하라고 답해 해소됨"
    by: ai
assumptions:
  - "배송비 무료 등 다른 선물하기 주문의 고객센터 값은 확인하지 못함. 같은 기준이라고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "기존 선물하기 주문 중 이미 저장된 points.earned는 재계산하지 않았으므로 옛 값(반올림, 배송비 포함)이 남아 있을 수 있음"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-basis.md — 선물하기 적립(src/gift/gift-points.js)도 일반 주문과 같은 기준이다(배송비 제외, 1P 미만 버림). G-0213은 218P (사람)"
---
## 요약
선물하기 적립이 배송비 포함 금액을 반올림해 G-0213이 249P로 나오던 것을, 일반 주문의 `earnPoints`를 쓰게 고쳐 218P로 맞췄다. 재현 테스트 2개를 추가했고 `npm test`는 24개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js`(`earnPoints` 위임). 테스트: `test/gift.test.js` 4, 5번째.
- 커밋 5ef57c2. 기준 커밋 23579ce에서는 새 테스트 2건이 실패한다.
- `src/format/`, `src/points/earn.js`, 메시지 카드·받는 사람 검증은 바뀌지 않았다.
