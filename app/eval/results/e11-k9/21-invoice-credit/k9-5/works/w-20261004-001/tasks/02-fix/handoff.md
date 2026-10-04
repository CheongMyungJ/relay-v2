---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "과세 줄마다 Math.floor(net * VAT_RATE_PERCENT / 100) 후 합산"
    why: "사람이 알려 준 회계팀 규칙 (intent 원하는 결과)"
    by: human
assumptions:
  - "정수 net에 대한 나눗셈 부동소수점 오차는 이 세율(10%)에서 문제 없다고 봄"
rejected:
  - "합계 기준 절사: 사람이 아니라고 했고 2643으로 회계팀 값 2641과 다름"
open_questions: []
intent_deviation: null
risks:
  - "src/invoice/credit-note.js:90 은 아직 합계 기준 Math.round 사용. 범위 밖이라 그대로 두었고 청구서와 반품 전표 부가세가 어긋날 수 있음"
  - "src/money.js의 percentOf는 반올림이며 이번에 쓰지 않음"
recommended_next: null
knowledge_candidates:
  - "회계팀 부가세 규칙: 과세 줄마다 할인 적용 후 금액에 세율을 곱해 원 단위 버림, 그 합이 청구서 부가세. 합계에서 재반올림하지 않음 (사람)"
  - "아직 규칙을 따르지 않음: src/invoice/credit-note.js:90 — 합계 기준 Math.round, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
부가세를 과세 줄별 원 단위 버림 합산으로 바꿨다. INV-2031은 vat 2641, total 29079이다. 재현 테스트 2개를 추가했고 npm test 48개가 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` computeTotals의 vat 계산이 바뀜
- `test/total.test.js` 마지막 두 테스트가 새로 추가됨. 기존 테스트 변경은 없음
- `src/format/`은 건드리지 않음
- 확인: `node src/cli.js examples/INV-2031.json --totals`
