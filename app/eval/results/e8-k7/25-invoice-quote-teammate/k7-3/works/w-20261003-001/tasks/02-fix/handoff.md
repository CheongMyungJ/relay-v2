---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 계산을 줄별 Math.floor 합으로 바꾸고 청구서(computeTotals)만 수정한다"
    why: "회계팀 기준과 intent 범위(청구서). 견적서·전표는 범위 밖으로 둠"
    by: ai
assumptions:
  - "세율 10%의 정수 곱·나눗셈에서 부동소수 오차로 floor가 틀어지는 경우는 없다고 봄"
rejected:
  - "발행분 재계산 가설: invoiceTotals가 저장된 totals를 사용하므로 해당 없음"
open_questions: []
intent_deviation: null
risks:
  - "credit-note.js:90과 quote.js:42-44는 여전히 합계 기준 반올림 방식이라 청구서와 부가세 규칙이 다름 (intent 범위 밖, 회계 확인 필요)"
  - "이미 발행됐지만 totals가 저장되지 않은 데이터가 있으면 새 규칙으로 다시 계산됨 (이 코드에서는 확인 못 함)"
recommended_next: null
knowledge_candidates:
  - "발행된 청구서는 invoiceTotals가 저장된 totals를 쓰므로 computeTotals를 바꿔도 발행분 합계는 변하지 않음 (src/invoice/invoice.js:41)"
  - "credit-note.js와 quote.js는 별도 부가세 계산(합계 기준 반올림)을 가짐. 청구서 규칙 변경 시 같이 볼지 확인 필요"
---
## 요약
INV-2031 합계가 29,082원에서 29,079원으로 맞게 되었다. 부가세를 줄마다 버림하여 합산한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js:28-29`
- 테스트: `test/total.test.js` 끝 3개 추가, `npm test` 51개 통과
- 전표(`src/invoice/credit-note.js:90`)와 견적(`src/invoice/quote.js:42`)은 미변경
- `src/format/`은 변경 없음
