---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 회수 비율을 적립률과 분리해 `POINT_RECOVERY_RATE_PERCENT = 1`로 고정"
    why: "비목표: 환불 회수 계산은 그대로. 새 비율은 정산팀과 따로 정함"
    by: ai
  - what: "적립 기준은 상품−쿠폰−사용 포인트의 2% 내림, 선물하기는 earnPoints에 위임"
    why: "docs/knowledge/point-earn-base-excludes-shipping.md, intent 제약"
    by: ai
assumptions: []
rejected:
  - "환불 회수에도 2% 적용: 비목표라 1%로 분리해 유지"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 기댓값 변경: test/order.test.js 500→1000, test/gift.test.js 300→600 (적립률 2% 정책 반영). 약화 여부는 verify가 판단"
  - "앞 Work(w-20261004-001, -002)에서 같은 파일을 고쳤을 수 있음, 머지 대기. earn.js/gift-points.js/refund.js 충돌 가능"
  - "환불 회수 1%는 저장된 earned(2% 기준)와 섞이면 부분 환불 회수값이 어긋날 수 있음. 정산팀 결정 대기"
recommended_next: null
knowledge_candidates:
  - "적립률은 config의 POINT_RATE_PERCENT(2), 환불 회수 비율은 POINT_RECOVERY_RATE_PERCENT(1)로 분리되어 있다. 회수에 새 비율을 쓸지는 정산팀과 따로 정한다 (사람)"
---
## 요약
적립률을 2%로 올리고 적립 기준을 배송비 제외·내림으로 바꿨다. O-1107은 486P. 환불 회수는 비율 상수를 1로 분리해 그대로다.
## 다음 task가 알아야 할 것
- `src/config.js` 상수 두 개, `src/points/earn.js`의 `earnBase`/`earnPoints`, `src/money.js`의 `floorPercentOf`
- 재현 테스트 `test/earn-rate.test.js`; `npm test` 24건 통과
- `src/format/` 변경 없음, `createRefund` 로직 변경 없음(상수 이름만)
