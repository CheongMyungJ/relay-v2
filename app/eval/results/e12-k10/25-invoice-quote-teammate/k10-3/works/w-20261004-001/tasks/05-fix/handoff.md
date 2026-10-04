---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "줄 부가세 계산을 `lineVat`(total.js)으로 모아 세 문서가 같이 쓴다"
    why: "세 문서가 같은 규칙을 쓰게 해 다시 어긋나지 않게 함"
    by: ai
assumptions:
  - "반품 전표 줄 부가세는 돌려받는 줄 공급가액(할인 반영) × 10% 줄별 버림이다"
  - "견적서의 영세율은 청구서와 같이 부가세 0"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "옛 규칙으로 저장된 청구서(INV-2047 부가세 5,801원)에 새 규칙 반품 전표를 붙이면 전부 반품해도 3원, CN-0112 일부 반품은 2원 차이가 난다. 보정 규칙은 만들지 않았고 사람이 판단할 일이다"
  - "quote.js와 credit-note.js가 total.js의 `lineVat`을 가져다 쓴다(모듈 의존 추가)"
recommended_next: null
knowledge_candidates:
  - "회계팀 부가세 규칙: 과세 줄마다 (할인 후 줄 금액 × 10%) 원 단위 버림, 그 합이 부가세, 합계에서 재반올림 없음. 구현은 src/invoice/total.js lineVat (사람)"
  - "정하지 않음: 반품 전표 부가세와 원 청구서 부가세의 맞물림 — 옛 규칙 저장 청구서와는 INV-2047 전부 반품 3원, CN-0112 일부 반품 2원 차이. 사람이 판단, 지금 코드는 보정 없음 (사람)"
---
## 요약
청구서·견적서·반품 전표의 부가세를 줄별 버림 합으로 통일했다. INV-2031은 부가세 2,641원, 합계 29,079원이다. `npm test` 54개가 통과하고, 새 테스트 4개는 수정 전에 실패했다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVat`, `src/money.js` `floorPercentOf`
- 확인 결과: INV-2047 새 규칙 재계산 부가세 5,798원, 저장값 5,801원. CN-0112 일부 반품(공급가액 17,438원) 새 규칙 1,742원, 옛 규칙이면 1,744원
- Q-0457 새 합계: 공급가액 52,691원, 부가세 3,587원, 합계 56,278원
- 저장된 totals와 `src/format/`은 변경 없음
- 테스트: `npm test`
