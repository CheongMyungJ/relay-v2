---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "이번 수정에서 src/gift/gift-points.js 수정을 허용한다"
    why: "팀 지식은 단독 수정 금지이나, 사람이 공유 파일인 줄 몰랐고 리포트가 이 파일을 지목한 자기 일이라며 수정을 허용했다"
    by: human
  - what: "src/format/ 불변, 이미 적립된 포인트 재계산 금지를 완료조건에 넣는다"
    why: "요청 원문과 사람의 답"
    by: human
assumptions:
  - "218P는 일반 주문 적립 기준(배송비 제외, 1P 미만 버림)에 맞춘 값으로 본다. G-0213의 상품 24,860 - 쿠폰 2,000 - 포인트 1,000 = 21,860원의 1%는 218.6이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "gift-points.js는 다른 팀과 공유 파일이라 수정이 그 팀에 영향을 줄 수 있다. 사람은 이번 수정을 허용했지만 다른 팀과의 합의는 확인되지 않았다"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/gift-points-ownership.md — 사람이 이 파일이 다른 팀과 공유인 줄 몰랐고, G-0213 건은 리포트가 이 파일을 지목한 이 팀의 일이라 수정을 허용했다. 공유 규칙이 아직 유효한지 확인이 필요하다 (사람)"
---
## 요약
G-0213 선물하기 적립 예정 포인트(249P)를 일반 주문 기준의 218P로 맞추는 버그 수정 intent 초안을 썼다. 사람이 gift-points.js 수정을 허용했다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `giftPoints`가 `percentOf(order.amounts.total, ...)`를 쓴다. 일반 주문은 `src/points/earn.js`의 `earnPoints`다. 이 비교는 참고용 가설이고 원인 확정이 아니다.
- 테스트: `npm test`(`node --test`), 선물 관련은 `test/gift.test.js`, 적립은 `test/earn.test.js`.
- 팀 지식 참고: `docs/knowledge/points/earn-points-basis.md`, `docs/knowledge/points/gift-points-ownership.md`.
- 예시 입력: `examples/G-0213.json`.
