---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "`money.js`의 `percentOf`는 그대로 두고 `earnPoints`만 직접 floor로 계산한다"
    why: "`gift-points.js`와 `refund.js`가 `percentOf`를 쓰므로 바꾸면 선물하기 적립이 달라진다(비목표)"
    by: ai
assumptions: []
rejected:
  - "`percentOf`를 floor로 변경: 선물하기 적립과 환불 회수가 같이 바뀐다"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불의 회수 포인트(`src/orders/refund.js:34`)는 여전히 `percentOf` 반올림이라 새 적립 규칙(소수점 버림)과 1P 어긋날 수 있다. 이번 범위 밖이라 두었다"
  - "선물하기 적립(`gift-points.js`)은 여전히 배송비 포함 total 기준 반올림이다. 다른 팀과 논의 중이라 두었다"
recommended_next: null
knowledge_candidates:
  - "포인트 적립 기준은 상품금액 - 쿠폰 - 사용 포인트이고 배송비는 제외, 소수점은 버린다 (사람)"
  - "정하지 않음: 선물하기 적립 규칙 — 다른 팀과 같이 정함, 지금 코드는 total 기준 반올림 (사람)"
  - "부분 환불 포인트 회수(`src/orders/refund.js:34`)는 percentOf 반올림이라 적립 규칙과 다를 수 있다"
---
## 요약
`earnPoints`를 배송비 제외 기준 금액 × 적립률, 소수점 버림으로 고쳤다. O-1042가 268P에서 237P로 나온다. 재현 테스트를 추가했고 `npm test`는 24개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, 테스트: `test/earn.test.js`(신규)
- `src/format/`, `src/gift/`는 바뀌지 않음. `percentOf`는 gift와 refund가 공유해 건드리지 않음.
- 확인 명령: `node src/cli.js examples/O-1042.json | grep 적립`
