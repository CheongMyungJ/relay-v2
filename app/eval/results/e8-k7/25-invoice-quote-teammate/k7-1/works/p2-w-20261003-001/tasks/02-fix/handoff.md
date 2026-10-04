---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적 부가세를 청구서와 같은 과세 줄별 할인 후 원 단위 버림 합산으로 바꿈"
    why: "팀 지식 docs/knowledge/vat-per-line-floor-after-discount.md 규칙과 intent 제약"
    by: ai
assumptions:
  - "경리 금액은 줄별 버림 규칙 값(56,278원)이라고 가정함. 경리 원본 값과는 직접 대조하지 못함"
rejected:
  - "저장된 totals 때문에 재계산 안 됨: 견적서는 생성 시 한 번만 계산하고 재계산 경로가 없음"
open_questions: []
intent_deviation: null
risks:
  - "이미 저장된 견적서의 totals는 다시 계산하지 않으므로 이전 방식 값이 남을 수 있음"
recommended_next: null
knowledge_candidates:
  - "견적서(quote.js quoteTotals)도 청구서·반품 전표와 같은 과세 줄별 할인 후 원 단위 버림 부가세로 바꿨다. 세 문서가 모두 같은 규칙이다."
---
## 요약
견적서 부가세를 과세 줄별 버림 합산으로 고쳤다. Q-0457은 부가세 3,589 → 3,587원, 합계 56,280 → 56,278원. 재현 테스트를 추가했고 `npm test` 55개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/quote.js`의 `quoteTotals`. 테스트: `test/quote.test.js` 끝의 2개.
- 견적 번호 검증과 유효 기간 함수는 건드리지 않았고 기존 테스트가 통과한다.
