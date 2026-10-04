---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 상품 금액 - 쿠폰 - 사용 포인트로 하고 1P 미만은 버린다"
    why: "기대값 237P가 나오는 기준이 이것뿐이다(배송비 포함 268P, 상품-쿠폰 253P, 반올림 238P는 모두 아님). 저장된 O-1077 값 403P와도 맞는다"
    by: ai
  - what: "공용 `percentOf`를 바꾸지 않고 `earnPoints`에서만 내림한다"
    why: "`giftPoints`가 `percentOf`를 쓰고 선물하기는 비목표다"
    by: ai
assumptions:
  - "내림(버림)이 고객센터 규칙이라고 본다. 237P 하나로 추론했고 다른 주문으로 확인하지 못했다"
rejected:
  - "상품 금액 - 쿠폰만 기준: 253P로 기대 237P와 다름"
  - "반올림 유지: 238P로 기대와 다름"
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립 `giftPoints`는 `amounts.total` 반올림으로 같은 문제가 남아 있다. 비목표라 건드리지 않았다. 다른 팀에 알려야 한다"
  - "버림 규칙은 O-1042 한 건으로 추론했다. 고객센터 규칙을 확인하면 좋다"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립 포인트는 상품 금액 - 쿠폰 - 사용 포인트(배송비 제외)의 1%를 1P 단위로 버린다 (`src/points/earn.js`)"
  - "선물하기 적립 `src/gift/gift-points.js`는 `amounts.total`(배송비 포함) 반올림이라 일반 주문과 기준이 다르다. 다른 팀과 같이 보고 있다"
---
## 요약
적립 예정 포인트가 배송비를 포함한 결제 금액을 반올림해서 많게 나왔다. 상품 - 쿠폰 - 사용 포인트를 버림하게 고쳐 O-1042가 237P가 되었다. 테스트 24건이 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, 테스트: `test/earn.test.js`(새 파일, 기존 테스트 변경 없음)
- O-1042 268→237P, O-1107 273→243P, O-1077은 403P로 그대로
- `src/format/`, `src/gift/` 변경 없음. 선물하기는 같은 문제가 남아 있음
- 명령: `npm test`, `node src/cli.js examples/O-1042.json`
