---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "업무 유형을 버그 수정(bugfix) 그대로 두고 초안을 쓴다"
    why: "요청이 적립률 변경(새 규정 적용)이라 유형이 어긋난다고 안내했으나 사람이 그대로 진행을 택함"
    by: human
assumptions:
  - "O-1107의 486P는 (상품 금액 − 쿠폰 − 사용 포인트)의 2%를 버림한 값(24,330 × 2% = 486.6 → 486)이라고 가정했다. 팀 지식의 적립 규정과 일치한다"
  - "선물하기 적립은 일반 주문 적립과 같은 규정이라 2%에 포함한다고 가정했다(사람이 같은 규정이면 포함이라 함)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이 브랜치의 `src/points/earn.js`는 결제 금액(배송비 포함, 사용 포인트 차감)에 `percentOf`(반올림)를 쓴다. 팀 지식의 규정(배송비 제외, 버림)은 앞 Work(w-20261004-002)에서 고쳤을 수 있고 머지 대기 중이다. 이번에 같은 코드를 건드리면 충돌할 수 있다"
  - "`POINT_RATE_PERCENT`(`src/config.js:9`)를 환불(`src/orders/refund.js:34`)도 공유한다. 상수만 2로 바꾸면 환불 회수도 바뀌므로 환불은 옛 비율을 유지해야 한다. 환불에 옛 값을 상수로 남겨도 규칙이 아니다"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 환불 때 회수 포인트를 새 적립률(2%)로 계산할지 — 정산팀과 따로 정함, 지금 코드는 `POINT_RATE_PERCENT`를 공유해 환불도 같이 바뀔 수 있는 상태 (사람)"
  - "2026-10-04부터 기본 적립률이 1%에서 2%로 바뀜. 이미 적립된 값은 다시 계산하지 않고 영수증 글자는 바꾸지 않는다 (사람)"
---
## 요약
일반 주문과 선물하기 적립률을 1%에서 2%로 올리는 intent 초안을 썼다. 환불 회수는 범위에서 뺐다. 기준 예시는 O-1107이고 486P가 나와야 한다. 저장된 값 재계산 금지와 `src/format/` 불변은 비목표와 완료조건에 넣었다.

## 다음 task가 알아야 할 것
- 비율 상수는 `src/config.js:9` `POINT_RATE_PERCENT`. 사용처는 `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`(환불은 이번 범위 밖)이다.
- 현재 코드(참고용 가설): O-1107을 `earnPoints`로 계산하면 `amounts.total`(배송비 3,000 포함, 27,330) 기준이라 2%에서 547이 나온다. 486은 배송비를 뺀 24,330의 버림 값이다. 상수만 2로 바꾸면 486이 되지 않을 수 있다.
- `percentOf`(`src/money.js`)는 `Math.round`다. 규정은 버림이다.
- 팀 지식 `docs/knowledge/points/earn-rule.md`는 기준 브랜치에 아직 없다(w-20261004-002 머지 대기).
- 테스트: `npm test` (`node --test`).
