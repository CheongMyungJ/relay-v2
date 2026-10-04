---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "리뷰 지적 사소 2건(floorPercentOf export 누락, 부가세 합산 식 중복)을 반영하지 않음"
    why: "사람이 반영하지 않음을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "intent의 원하는 결과는 total.js 한정이었으나 사람 답변으로 credit-note.js까지 변경됨"
  - "export(monthly, ledger, csv)는 새 발행분부터 부가세 값이 달라짐"
  - "영세율을 직접 확인하는 새 테스트는 없음(코드와 기존 테스트로 확인)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 결과 사소 지적 2건이 나왔고 사람이 반영하지 않기로 했다. 완료조건 7개 모두 통과했다. `npm test` 50개 통과, INV-2031 직접 실행 결과 부가세 2,641원, 합계 29,079원이다. 테스트 파일 변경은 추가뿐이라 약화가 아니다.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
## 다음 task가 알아야 할 것
- 사소 지적: `src/index.js:3` floorPercentOf export 없음, `total.js`/`credit-note.js`의 합산 식 중복
- `src/format/` 변경 없음
