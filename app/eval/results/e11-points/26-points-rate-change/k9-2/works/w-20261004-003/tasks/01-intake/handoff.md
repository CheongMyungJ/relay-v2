---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "업무 유형은 요청이 정책 변경이어도 bugfix 그대로 진행한다"
    why: "사람이 유형 불일치 질문에 bugfix 유지를 선택했다"
    by: human
  - what: "적립 기준은 팀 지식 규칙(배송비 제외, 버림)을 따르고 O-1107 기대값은 486P로 둔다"
    why: "팀 지식 earn-rule.md와 요청의 486P가 일치한다 (24,330 x 2% = 486.6 -> 486)"
    by: ai
  - what: "환불 회수 포인트 동작은 이번 변경으로 바뀌지 않게 하고 비목표로 둔다"
    why: "사람이 환불 회수 비율은 정산팀과 따로 정한다고 했다"
    by: human
assumptions:
  - "선물하기 포인트는 같은 POINT_RATE_PERCENT 상수를 쓰므로 비율이 같이 바뀐다고 보았다. 선물하기의 배송비 포함 반올림 방식은 이번에 고치지 않는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "refund.js:34가 POINT_RATE_PERCENT를 직접 쓰므로 상수만 2로 바꾸면 환불 회수가 바뀐다. 환불용 비율을 분리하는 등 동작을 유지하는 방법이 필요하다(방법은 fix에서 정한다)"
  - "선물하기 포인트(src/gift/gift-points.js)가 상수를 공유하면 2%로 같이 오른다. 의도한 것인지 사람 확인이 필요할 수 있다"
  - "앞 Work(w-20261004-001, w-20261004-002)에서 earn.js와 refund.js를 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "환불 회수 포인트에 새 적립률(2%)을 쓸지는 정산팀과 따로 정함. 이번 Work 범위에서 뺌 (사람)"
  - "적립률 정책: 이번 배포(2026-10-04)부터 기본 적립률이 1%에서 2%로 바뀜. 예시 O-1107은 486P (사람)"
---
## 요약
적립률을 1%에서 2%로 올리는 intent 초안을 썼다. 사람이 유형을 bugfix로 유지하라고 확인했다. 이미 저장된 적립값, 영수증 글자, 환불 회수 동작은 건드리지 않는다.
## 다음 task가 알아야 할 것
- 참고(내 가설, 확인 안 됨): 이 브랜치의 `src/points/earn.js:6`은 `amounts.total`(배송비 포함, 사용 포인트 차감)을 `percentOf`로 반올림한다. O-1107 기준 total은 27,330원이라 2%면 547P가 되어 486P와 다르다.
- `POINT_RATE_PERCENT`는 `src/config.js:9`. 사용처(환불은 바뀌면 안 됨): `src/points/earn.js`, `src/orders/refund.js:34`, `src/gift/gift-points.js:6`.
- `percentOf`(`src/money.js`)는 반올림이다. 버림이 필요하다.
- 참고 지식: docs/knowledge/points/earn-rule.md, docs/knowledge/points/stored-earned-points.md (기준 브랜치에 아직 없을 수 있음)
- 테스트: `npm test` (node --test)
