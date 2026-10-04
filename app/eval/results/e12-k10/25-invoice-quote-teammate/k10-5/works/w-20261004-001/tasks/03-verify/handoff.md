---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 1번(견적 할인 줄 테스트)만 반영, 2번(식 중복)은 반영하지 않음"
    why: "사람이 1번만 반영하기로 골랐다"
    by: human
assumptions: []
rejected:
  - "지적 2 식 중복 헬퍼화: 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "견적서 부가세가 할인 있는 줄에서 이전과 달라진다"
  - "반품 전표 줄 부가세가 원 청구서와 1원 어긋날 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(사소) 중 1건을 반영해 견적 할인 줄 테스트를 추가했다(커밋 eb57654). 완료조건 7개 모두 통과, `npm test` 52 통과, INV-2031 합계 29,079원. 테스트 파일 변경은 모두 약화 아님.
새 지식: docs/knowledge/billing/vat-rounding.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없었음
## 다음 task가 알아야 할 것
- 부가세 계산: `src/money.js` `percentOfFloor`, `src/invoice/total.js:26`, `credit-note.js:90`, `quote.js:42`
- 검증 명령: `npm test`, `node src/cli.js examples/INV-2031.json --totals`
- `pr.md`는 task 디렉터리에 있다.
