---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적서(src/invoice/quote.js)와 반품 전표(src/invoice/credit-note.js:90)는 합계 기준 반올림이라 청구서와 부가세가 어긋날 수 있음(범위 밖)"
  - "회계팀 공식 기준 미확인"
  - "net이 음수인 줄의 Math.floor 동작은 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없었다. 완료조건 6개 모두 통과했다. INV-2031은 2,641원/29,079원이고 npm test는 50개 통과다. 바뀐 테스트 파일은 추가만 있어 약화가 아니다.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 부가세 계산 규칙을 다루는 기존 항목이 없어서
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` vat 계산. 테스트: `test/total.test.js` 끝 2개.
- 규칙을 아직 따르지 않는 곳: `src/invoice/quote.js:42`, `src/invoice/credit-note.js:90`
- 확인: `npm test`, `node src/cli.js examples/INV-2031.json --totals`
