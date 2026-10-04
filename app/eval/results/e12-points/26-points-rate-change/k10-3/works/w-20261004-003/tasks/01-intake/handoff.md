---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "유형은 bugfix 그대로 진행한다 (정책 변경이라 feature에 가깝다는 점을 알렸음)"
    why: "사람이 유형 불일치 질문에 'bugfix 그대로 진행'을 선택"
    by: human
assumptions:
  - "O-1107의 486P는 기준 24,330원(27,350 − 2,000 − 1,020, 배송비 제외) × 2% 버림으로 맞아떨어진다. 팀 지식의 적립 기준과 같다"
  - "주문, 선물, 환불 회수 모두 2%를 적용한다. 이들이 같은 설정값을 쓴다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이 브랜치의 코드는 아직 결제 금액(배송비 포함) 기준으로 적립한다. 팀 지식의 적립 기준(배송비 제외, 버림)은 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 그 수정 없이 율만 2%로 바꾸면 O-1107은 546P가 되어 486P와 다르다"
  - "부분 환불 회수 규칙도 앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "적립률은 2026-10-04 배포부터 기본 1%에서 2%로 올림. 이미 적립된 포인트는 다시 계산하지 않고 저장된 값을 둔다 (사람)"
  - "영수증 글자(src/format/)는 바뀌면 안 된다 (사람)"
---
## 요약
적립률 1%→2% 변경 요청을 bugfix 유형 그대로 의도로 정리했다. 기준은 O-1107이 486P가 되는 것이다.
## 다음 task가 알아야 할 것
- `src/config.js:9` `POINT_RATE_PERCENT = 1`. 이 값은 `src/points/earn.js`, `src/gift/gift-points.js`, `src/orders/refund.js:34`가 쓴다.
- 현재 `earn.js`와 `gift-points.js`는 `order.amounts.total` 기준이다. 팀 지식은 상품−쿠폰−사용 포인트(배송비 제외) 기준이다. 기준 브랜치와 팀 지식이 어긋나는지 fix에서 확인할 것.
- O-1107 계산: 상품 27,350, 쿠폰 2,000, 사용 포인트 1,020, 기준 24,330, 2% = 486.6 → 486.
- 참고 지식: docs/knowledge/points/earn-base.md, docs/knowledge/points/partial-refund-recovery.md
- 테스트: `npm test`. README 10행에 적립률 안내가 있다.
