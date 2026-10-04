---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "버림 함수 floorPercentOf를 money.js에 새로 추가하고 percentOf는 그대로 둔다"
    why: "percentOf는 적립·선물 등 다른 호출처가 있고 이번 범위 밖이다"
    by: ai
  - what: "intent의 공식(저장된 earned − 남은 상품 재계산 적립)을 그대로 구현한다"
    why: "intent 원하는 결과에 명시. 팀 지식의 비율 안분 규칙은 사람이 intake에서 대체함"
    by: ai
assumptions:
  - "남은 상품 금액은 기존 remainingGoods(이전 환불 수량 포함 차감)를 그대로 쓴다"
rejected:
  - "비율 안분 후 버림: 사람이 기준이 아니라고 함, 같은 예에서 약 111P"
open_questions: []
intent_deviation: null
risks:
  - "여러 번 나눠 환불하면 각 환불의 회수값이 '원래 적립 − 그 시점 남은 적립'이라 이전 환불의 회수분을 포함한다. 입력에 이전 회수 포인트가 없어 합계가 earned를 넘을 수 있다. 2차 환불 호출자가 이전 회수분을 빼야 하는지 확인 필요"
  - "저장된 earned가 재계산 값보다 작으면 회수가 음수가 될 수 있다(현재 earnPoints는 total 기준이라 정상 데이터에서는 안 생김). 방어 코드는 넣지 않음"
  - "팀 지식 항목은 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에 없다. 그 Work가 refund.js를 이미 고쳤을 수 있어 머지 때 충돌 가능, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-basis.md — 부분 환불 회수 포인트 = 저장된 earned − (남은 상품 − 쿠폰 − 사용 포인트)의 적립률%를 버림한 값. 배송비 제외, 비율 안분 규칙 대체 (사람)"
  - "업무 사실: 정산팀 대조 기준 R-0311(O-1077) 회수 포인트는 132P (사람)"
---
## 요약
부분 환불 회수 포인트를 `저장된 earned − floor((남은 상품 − 쿠폰 − 사용 포인트) × 1%)`로 바꿨다. R-0311은 131P에서 132P가 됐다. 테스트 2개를 추가했고 `npm test` 22개가 통과한다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js:34` 근처가 변경 지점, `src/money.js`에 `floorPercentOf` 추가
- 새 테스트: `test/refund.test.js` 끝 2개(수정 전 실패 확인함)
- 재현: O-1077/R-0311 → 132
- 다회 부분 환불의 회수 합계가 earned를 넘을 수 있는 점은 risks 참고
