---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 계산을 공용 함수 `vatOfLines`(money.js)로 두고 청구서·견적·대변전표가 함께 쓴다"
    why: "세 곳이 같은 규정을 따라야 하고 intent가 견적·대변전표 포함을 정함"
    by: ai
assumptions:
  - "발행된 청구서·전표의 재계산 경로는 없다고 판단(export와 합계 조회 코드가 저장 합계를 읽는 것을 코드로 확인)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적의 기존 계산(할인 전 총액 기준)과 값이 달라질 수 있음. 기존 견적 테스트는 그대로 통과"
  - "`vatOfLines`는 부동소수 곱셈 후 floor라 소수 세율에서는 경계값 오차 가능. 현재 세율은 정수 10%"
  - "수정 전 확인용으로 git stash를 잠깐 썼고 pop으로 복원함(스택 비어 있음)"
recommended_next: null
knowledge_candidates:
  - "부가세 규정: 품목 줄마다(할인 적용 후 금액) 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다 (사람)"
  - "발행된 청구서는 재계산하지 않고 저장된 합계를 쓴다 (사람)"
  - "부가세 계산 위치: src/money.js vatOfLines를 total.js, quote.js, credit-note.js가 공용으로 쓴다"
---
## 요약
청구서·견적·대변전표의 부가세를 줄별 원 단위 버림 합산으로 바꿨다. INV-2031이 2,641원/29,079원이 된다. 재현 테스트 4개를 추가했고 수정 전 실패, 수정 후 통과를 확인했다.
## 다음 task가 알아야 할 것
- 공용 함수: `src/money.js` `vatOfLines`. 사용처 `src/invoice/total.js:26`, `credit-note.js:90`, `quote.js:40`
- `npm test`: 52 pass. 기존 테스트 변경 없음
- 발행 합계는 `invoiceTotals`/`creditNoteTotals`가 저장값 사용. `src/format/` 무변경
- 커밋 1개(relay/w-20261004-001)
