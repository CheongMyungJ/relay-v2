---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 회수 비율을 적립률과 분리한 `REFUND_RECOVER_RATE_PERCENT = 1`로 둠"
    why: "의도의 비목표: 환불 회수 결과는 이번 변경으로 달라지지 않아야 함"
    by: ai
  - what: "적립 기준을 상품−쿠폰−사용 포인트로 하고 버림 적용 (`earnBase`/`pointsOf`)"
    why: "docs/knowledge/points/earn-rule.md 규칙, O-1107 486P"
    by: ai
  - what: "선물하기 적립도 같은 규칙과 2%를 쓰게 함"
    why: "intake 가정: 적립 계산이므로 2% 대상"
    by: ai
assumptions:
  - "earn-rule.md는 기준 브랜치에 없어 지금 코드에는 earnBase가 없었다. 규칙대로 새로 만들었다"
rejected:
  - "비율 상수만 2로 변경: 배송비 포함 total 기준이라 O-1107이 546P가 되고 환불 회수도 바뀜"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 기대값 변경: test/order.test.js 500→1000, test/gift.test.js 300→600 (1%→2%). 약화 여부는 verify가 판단"
  - "앞 Work(w-20261004-001)에서 earnBase를 이미 고쳤을 수 있음, 머지 대기. 머지 때 src/points/earn.js 충돌 가능"
  - "재현 테스트를 수정 전 코드에 직접 돌려 실패를 확인하지는 않음(같은 입력의 수정 전 결과 273P만 확인)"
recommended_next: null
knowledge_candidates:
  - "환불 회수 비율은 `REFUND_RECOVER_RATE_PERCENT`(1%)로 적립률과 분리됨. 정산팀과 정하기 전까지 유지 (사람)"
  - "기본 적립률은 2026-10-04 배포부터 2% (사람)"
---
## 요약
적립률을 2%로 올리고 적립 기준에서 배송비를 빼고 버림하게 해 O-1107이 486P가 되었다. 선물하기도 같은 규칙이다. 환불 회수는 1% 전용 상수로 분리해 결과가 그대로다. `npm test` 21개 통과.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `earnBase`/`pointsOf`/`earnPoints`; `src/config.js`: `POINT_RATE_PERCENT=2`, `REFUND_RECOVER_RATE_PERCENT=1`
- 환불 확인: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` 수정 전후 출력 동일
- 기존 테스트 변경 2건(order, gift 기대값), `src/format/` 변경 없음
