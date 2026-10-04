---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 계산을 total.js가 아니라 credit-note.js 안의 `sumCreditLineVat`에 두었다"
    why: "지식 항목은 total.js의 sumLineVat를 말하지만 기준 브랜치에 없고 앞 Work(w-20261004-001)가 만든다. 같은 이름을 만들면 머지 충돌이 나고 computeTotals는 이번 범위 밖이다"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 sumLineVat를 만들었을 수 있음, 머지 대기. 머지 뒤 sumCreditLineVat를 sumLineVat로 합치는 정리가 필요할 수 있음"
  - "computeTotals는 여전히 합계에서 한 번 반올림한다 (이번 범위 밖, 앞 Work에서 고쳤을 수 있음)"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세는 돌려받는 과세 줄마다 (공급가액 × 세율)을 원 단위 버림해 합한다. creditTotals는 src/invoice/credit-note.js의 sumCreditLineVat를 쓴다 (사람)"
---
## 요약
반품 전표 부가세를 줄마다 버림한 합으로 바꿔 CN-0112 환불 합계가 19,180원이 되었다. 재현 테스트 3개를 더했고 npm test는 49개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js`의 `sumCreditLineVat`와 `creditTotals`
- 테스트: `test/credit-note.test.js` 끝의 새 테스트 3개. 수정 전에는 3개 실패, 수정 뒤 통과
- `returnedDiscount`(금액 할인 수량 비율 반올림)는 바꾸지 않았고 563원 등 값을 테스트로 고정했다
- 기존 테스트 변경 없음
