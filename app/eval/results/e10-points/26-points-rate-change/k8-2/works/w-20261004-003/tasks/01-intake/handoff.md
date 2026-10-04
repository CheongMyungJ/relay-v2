---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "업무 유형은 요청이 새 정책(적립률 변경)에 가까워도 선택한 bugfix로 진행한다"
    why: "유형 불일치를 물었고 사람이 그대로 진행을 골랐다"
    by: human
  - what: "부분 환불 회수는 이번 범위에서 제외하고 건드리지 않는다"
    why: "사람 지시: 환불 회수에 새 비율을 쓸지는 정산팀과 따로 정한다"
    by: human
  - what: "O-1107의 기대 적립은 486P로 완료조건에 쓴다"
    why: "요청 원문에 고객센터 계산값으로 적혀 있다"
    by: human
assumptions:
  - "선물하기 주문도 일반 주문과 같은 새 적립률을 쓴다고 본다 (요청이 '기본 적립률'이라고 함)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "createRefund(src/orders/refund.js:34)가 POINT_RATE_PERCENT를 직접 쓴다. 상수만 2로 바꾸면 환불 회수도 바뀌므로 환불은 기존 1%가 유지되게 분리해야 한다"
  - "이 브랜치의 적립 계산은 결제 금액(배송비 포함, 반올림)이라 비율만 2%로 바꾸면 O-1107이 547P가 되어 486P와 다르다. 앞 Work(w-20261004-001/002)가 배송비 제외·버림으로 고쳤고 머지 대기라 이 브랜치에는 아직 없을 수 있다"
  - "앞 Work 변경과 충돌하거나 중복될 수 있다"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트에 새 적립률(2%)을 쓸지는 정산팀과 따로 정한다. 적립률 변경 Work에서는 환불을 건드리지 않는다 (사람)"
  - "기본 적립률을 1%에서 2%로 올림(2026-10-04 배포부터). 이미 적립된 포인트는 재계산하지 않고 저장값 유지, 영수증 글자(src/format/)는 바뀌면 안 됨 (사람)"
---
## 요약
적립률 1%→2% 변경 요청을 bugfix 유형으로 의도 초안에 정리했다. 유형 불일치는 물었고 사람이 그대로 진행을 골랐다.
## 다음 task가 알아야 할 것
- 적립률: `src/config.js:9` `POINT_RATE_PERCENT`. 적립 사용처 `src/points/earn.js:6`, `src/gift/gift-points.js:6`. 환불 `src/orders/refund.js:34`도 같은 상수를 쓰지만 이번 범위 밖이라 값이 안 바뀌어야 한다
- 이 브랜치 `earnPoints`는 `order.amounts.total`(배송비 포함)에 `percentOf`(`src/money.js:14`, `Math.round`)를 쓴다. O-1107: total 27,330원 → 2%면 547P. 기대 486P는 24,330원(배송비 제외)×2% 버림과 같다.
- 참고 지식: `docs/knowledge/points/earn-basis.md` (기준 브랜치에는 아직 없음, Work w-20261004-002)
- 테스트: `npm test` (`node --test`)
- 가설(참고만): 비율만 바꾸면 486P가 안 나오므로 적립 기준 차이를 fix에서 확인해야 한다.
